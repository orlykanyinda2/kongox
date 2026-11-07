-- =====================================================================
-- KongoX — Étape 4 : football (1 N 2), classements, profils publics,
-- communautés et abonnements
-- =====================================================================
-- Les matchs viennent d'un fournisseur (API-Football pour l'instant) par
-- un import économe côté serveur. Chaque match crée un marché « 1n2 »
-- (options 1, N, 2) qui réutilise la cagnotte, la limite quotidienne et
-- le règlement automatique.
-- Mode test : la saison 2024 (gratuite) est rejouée avec un décalage de
-- dates (football_decalage_jours, multiple de 7 pour garder les jours de
-- la semaine). En production : saison en cours et décalage 0.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------
insert into public.reglages (cle, libelle, valeur, minimum, maximum) values
  ('football_saison',            'Saison de football importée (2024 = données de test)',   2024, 2000, 2100),
  ('football_decalage_jours',    'Décalage des dates en mode test (jours, 0 en production)', 728, 0, 3650),
  ('football_jours_a_venir',     'Matchs à venir importés (jours)',                         7,   1, 14),
  ('api_football_limite_jour',   'Requêtes API-Football par jour (maximum)',                90,  1, 100000),
  ('classement_min_predictions', 'Prédictions réglées pour entrer au classement',           5,   1, 100);


-- ---------------------------------------------------------------------
-- 2. Ligues, équipes, matchs
-- ---------------------------------------------------------------------
create table public.ligues (
  id          bigint generated always as identity primary key,
  fournisseur text     not null default 'api_football',
  id_externe  bigint   not null,
  nom         text     not null,
  pays        text     not null,
  ordre       smallint not null default 0,
  active      boolean  not null default true,
  constraint ligues_externe_unique unique (fournisseur, id_externe)
);

insert into public.ligues (id_externe, nom, pays, ordre) values
  (39,  'Premier League',      'Angleterre', 1),
  (2,   'Ligue des champions', 'Europe',     2),
  (140, 'Liga',                'Espagne',    3),
  (135, 'Serie A',             'Italie',     4),
  (78,  'Bundesliga',          'Allemagne',  5),
  (61,  'Ligue 1',             'France',     6),
  (424, 'Linafoot',            'RDC',        7);

create table public.equipes (
  id          bigint generated always as identity primary key,
  fournisseur text not null default 'api_football',
  id_externe  bigint not null,
  nom         text not null,
  logo_url    text,
  constraint equipes_externe_unique unique (fournisseur, id_externe)
);

create table public.matchs (
  id            bigint generated always as identity primary key,
  fournisseur   text        not null default 'api_football',
  id_externe    bigint      not null,
  ligue_id      bigint      not null references public.ligues (id),
  saison        integer     not null,
  journee       text,
  date_match    timestamptz not null,   -- date affichée (avec le décalage de test)
  date_api      timestamptz not null,   -- date réelle chez le fournisseur
  equipe_dom_id bigint      not null references public.equipes (id),
  equipe_ext_id bigint      not null references public.equipes (id),
  statut        text        not null default 'a_venir',
  buts_dom      integer,                -- score publié (après la fin du match)
  buts_ext      integer,
  statut_api    text,                   -- dernière réponse du fournisseur
  buts_dom_api  integer,                -- score à 90 minutes chez le fournisseur
  buts_ext_api  integer,
  marche_id     bigint      unique references public.marches (id),
  maj_api_le    timestamptz,
  cree_le       timestamptz not null default now(),
  constraint matchs_externe_unique unique (fournisseur, id_externe),
  constraint matchs_statut_valide check (statut in ('a_venir', 'en_cours', 'termine', 'annule', 'reporte'))
);
create index matchs_date on public.matchs (date_match);
create index matchs_statut_date on public.matchs (statut, date_match);
create index matchs_ligue_date on public.matchs (ligue_id, date_match);

-- Marchés « 1n2 » (un par match)
alter table public.marches drop constraint marches_type_valide;
alter table public.marches add constraint marches_type_valide check (type_reponse in ('oui_non', 'choix_multiples', '1n2'));


-- ---------------------------------------------------------------------
-- 3. Compteur d'appels au fournisseur et journal des imports
-- ---------------------------------------------------------------------
create table public.appels_api (
  jour        date    not null,       -- jour de Kinshasa
  fournisseur text    not null,
  nombre      integer not null default 0,
  primary key (jour, fournisseur)
);

create table public.imports_football (
  id            bigint generated always as identity primary key,
  type          text        not null,     -- a_venir | resultats
  debut         timestamptz not null default now(),
  fin           timestamptz,
  statut        text,                     -- ok | erreur | limite | rien_a_faire
  appels        integer     not null default 0,
  matchs        integer     not null default 0,
  message       text,
  declenche_par text        not null default 'automatique',  -- automatique | admin | cron
  constraint imports_type_valide check (type in ('a_venir', 'resultats'))
);
create index imports_football_date on public.imports_football (type, debut desc);

-- Réserve une requête pour aujourd'hui ; faux si la limite est atteinte (l'import s'arrête)
create function public.reserver_appel_api(p_fournisseur text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  insert into public.appels_api (jour, fournisseur, nombre)
  values ((now() at time zone 'Africa/Kinshasa')::date, p_fournisseur, 1)
  on conflict (jour, fournisseur) do update
    set nombre = public.appels_api.nombre + 1
    where public.appels_api.nombre < public.reglage('api_football_limite_jour')
  returning nombre into v_nombre;
  return v_nombre is not null;
end;
$$;

-- Commence un import (null si un import du même type tourne déjà depuis moins de 5 minutes)
create function public.commencer_import(p_type text, p_declenche_par text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('kongox-import-' || p_type));
  if exists (select 1 from public.imports_football where type = p_type and fin is null and debut > now() - interval '5 minutes') then
    return null;
  end if;
  insert into public.imports_football (type, declenche_par) values (p_type, coalesce(p_declenche_par, 'automatique')) returning id into v_id;
  return v_id;
end;
$$;

create function public.terminer_import(p_import bigint, p_statut text, p_appels integer, p_matchs integer, p_message text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.imports_football
     set fin = now(), statut = p_statut, appels = coalesce(p_appels, 0), matchs = coalesce(p_matchs, 0), message = left(p_message, 500)
   where id = p_import;
$$;

-- Ce qu'il faut importer : les matchs à venir une fois par jour (après 20 h sans import réussi),
-- et les résultats des matchs terminés (fin estimée = coup d'envoi + 2 h) encore inconnus.
create function public.besoins_import()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'a_venir', not exists (select 1 from public.imports_football
                            where type = 'a_venir' and statut = 'ok' and debut > now() - interval '20 hours'),
    'resultats', coalesce((select jsonb_agg(id_externe) from (
        select m.id_externe from public.matchs m
         where m.statut in ('a_venir', 'en_cours')
           and m.date_match + interval '2 hours' <= now()
           and coalesce(m.statut_api, '') not in ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO', 'PST')
           and (m.maj_api_le is null or m.maj_api_le < now() - interval '30 minutes')
         order by m.date_match limit 20) x), '[]'::jsonb),
    'saison', public.reglage('football_saison'),
    'decalage_jours', public.reglage('football_decalage_jours'),
    'jours_a_venir', public.reglage('football_jours_a_venir'),
    'ligues', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'id_externe', id_externe, 'nom', nom) order by ordre), '[]'::jsonb)
                 from public.ligues where active)
  );
$$;


-- ---------------------------------------------------------------------
-- 4. Règlement interne (sans contrôle admin) : utilisé par les matchs
-- ---------------------------------------------------------------------
-- Le corps de regler_marche (étape 2) est déplacé ici ; regler_marche garde
-- la vérification admin et appelle cette fonction.
create function public.regler_marche_interne(p_marche bigint, p_option_gagnante bigint, p_lien_resultat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche    public.marches%rowtype;
  v_cagnotte  bigint;
  v_gagnant   bigint;
  v_distribue bigint;
  v_reste     bigint;
  v_libelle   text;
  g           record;
begin
  if p_lien_resultat is null or btrim(p_lien_resultat) = '' then
    raise exception 'Le lien de la source est obligatoire.' using hint = 'lien_obligatoire';
  end if;
  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut not in ('approuve', 'ferme') then
    raise exception 'Ce marché ne peut pas être réglé.' using hint = 'statut_invalide';
  end if;
  select libelle into v_libelle from public.options_marche where id = p_option_gagnante and marche_id = p_marche;
  if not found then
    raise exception 'Option invalide.' using hint = 'option_invalide';
  end if;

  select coalesce(sum(total_mise), 0) into v_cagnotte from public.options_marche where marche_id = p_marche;
  select coalesce(sum(montant), 0) into v_gagnant
    from public.predictions where marche_id = p_marche and option_id = p_option_gagnante and statut = 'en_cours';

  update public.marches
     set statut = 'regle', option_gagnante_id = p_option_gagnante, lien_resultat = btrim(p_lien_resultat), regle_le = now()
   where id = p_marche;

  if v_gagnant = 0 then
    perform public.rembourser_marche(p_marche, v_marche.question);
    return jsonb_build_object('cagnotte', v_cagnotte, 'gagnants', 0, 'rembourse', true);
  end if;

  select coalesce(sum((montant * v_cagnotte) / v_gagnant), 0) into v_distribue
    from public.predictions where marche_id = p_marche and option_id = p_option_gagnante and statut = 'en_cours';
  v_reste := v_cagnotte - v_distribue;

  for g in
    select id, utilisateur_id,
           (montant * v_cagnotte) / v_gagnant
             + case when row_number() over (order by (montant * v_cagnotte) % v_gagnant desc, id) <= v_reste then 1 else 0 end as gain
      from public.predictions
     where marche_id = p_marche and option_id = p_option_gagnante and statut = 'en_cours'
     order by id
  loop
    if g.gain > 0 then
      perform public.mouvement_pieces(g.utilisateur_id, g.gain, 'gain', 'Gagné (' || v_libelle || ') : ' || v_marche.question, p_marche);
    end if;
    update public.predictions set statut = 'gagnee', gain = g.gain where id = g.id;
  end loop;

  update public.predictions set statut = 'perdue'
   where marche_id = p_marche and option_id <> p_option_gagnante and statut = 'en_cours';

  return jsonb_build_object('cagnotte', v_cagnotte, 'gagnants',
    (select count(*) from public.predictions where marche_id = p_marche and statut = 'gagnee'), 'rembourse', false);
end;
$$;

create or replace function public.regler_marche(p_marche bigint, p_option_gagnante bigint, p_lien_resultat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  return public.regler_marche_interne(p_marche, p_option_gagnante, p_lien_resultat);
end;
$$;

create function public.annuler_marche_interne(p_marche bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche public.marches%rowtype;
begin
  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut not in ('approuve', 'ferme') then
    return;
  end if;
  update public.marches set statut = 'regle', option_gagnante_id = null, motif = nullif(btrim(p_motif), ''), regle_le = now() where id = p_marche;
  perform public.rembourser_marche(p_marche, v_marche.question);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Enregistrer les matchs reçus du fournisseur (format commun)
-- ---------------------------------------------------------------------
-- p_matchs : [{ "id_externe", "ligue_externe", "saison", "journee", "date_api",
--               "statut_api", "buts_dom", "buts_ext",
--               "dom": {"id_externe","nom","logo_url"}, "ext": {...} }]
create function public.enregistrer_matchs(p_fournisseur text, p_matchs jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  x          jsonb;
  v_nb       integer := 0;
  v_ligue    public.ligues%rowtype;
  v_dom      bigint;
  v_ext      bigint;
  v_date_api timestamptz;
  v_date     timestamptz;
  v_match    public.matchs%rowtype;
  v_marche   bigint;
  v_nom_dom  text;
  v_nom_ext  text;
  v_decalage interval := make_interval(days => public.reglage('football_decalage_jours')::integer);
begin
  for x in select * from jsonb_array_elements(coalesce(p_matchs, '[]'::jsonb)) loop
    select * into v_ligue from public.ligues where fournisseur = p_fournisseur and id_externe = (x ->> 'ligue_externe')::bigint;
    continue when not found;

    insert into public.equipes (fournisseur, id_externe, nom, logo_url)
    values (p_fournisseur, (x -> 'dom' ->> 'id_externe')::bigint, x -> 'dom' ->> 'nom', x -> 'dom' ->> 'logo_url')
    on conflict (fournisseur, id_externe) do update set nom = excluded.nom, logo_url = excluded.logo_url
    returning id, nom into v_dom, v_nom_dom;
    insert into public.equipes (fournisseur, id_externe, nom, logo_url)
    values (p_fournisseur, (x -> 'ext' ->> 'id_externe')::bigint, x -> 'ext' ->> 'nom', x -> 'ext' ->> 'logo_url')
    on conflict (fournisseur, id_externe) do update set nom = excluded.nom, logo_url = excluded.logo_url
    returning id, nom into v_ext, v_nom_ext;

    v_date_api := (x ->> 'date_api')::timestamptz;
    v_date := v_date_api + v_decalage;

    select * into v_match from public.matchs where fournisseur = p_fournisseur and id_externe = (x ->> 'id_externe')::bigint for update;
    if not found then
      insert into public.matchs (fournisseur, id_externe, ligue_id, saison, journee, date_match, date_api, equipe_dom_id, equipe_ext_id,
                                 statut_api, buts_dom_api, buts_ext_api, maj_api_le)
      values (p_fournisseur, (x ->> 'id_externe')::bigint, v_ligue.id, (x ->> 'saison')::integer, x ->> 'journee', v_date, v_date_api,
              v_dom, v_ext, x ->> 'statut_api', (x ->> 'buts_dom')::integer, (x ->> 'buts_ext')::integer, now())
      returning * into v_match;
    else
      -- Un match terminé ne bouge plus ; sinon la date peut changer (match reporté)
      update public.matchs
         set statut_api = x ->> 'statut_api', buts_dom_api = (x ->> 'buts_dom')::integer, buts_ext_api = (x ->> 'buts_ext')::integer,
             date_api = case when statut in ('a_venir') then v_date_api else date_api end,
             date_match = case when statut in ('a_venir') then v_date else date_match end,
             journee = coalesce(x ->> 'journee', journee), maj_api_le = now()
       where id = v_match.id
      returning * into v_match;
      if v_match.marche_id is not null and v_match.statut = 'a_venir' then
        update public.marches set date_fin = v_match.date_match
         where id = v_match.marche_id and statut = 'approuve' and date_fin <> v_match.date_match and v_match.date_match > now();
      end if;
    end if;

    -- Un marché 1 N 2 par match à venir
    if v_match.marche_id is null and v_match.statut = 'a_venir' and v_match.date_match > now() + interval '10 minutes' then
      insert into public.marches (question, categorie, type_reponse, date_fin, source, statut, date_publication, examine_le)
      values (left(v_nom_dom || ' – ' || v_nom_ext || ' : qui gagne ?', 200), 'football', '1n2', v_match.date_match,
              'Résultat officiel (' || v_ligue.nom || ')', 'approuve', now(), now())
      returning id into v_marche;
      insert into public.options_marche (marche_id, libelle, ordre) values (v_marche, '1', 0), (v_marche, 'N', 1), (v_marche, '2', 2);
      update public.matchs set marche_id = v_marche where id = v_match.id;
    end if;
    v_nb := v_nb + 1;
  end loop;

  perform public.appliquer_resultats();
  return v_nb;
end;
$$;

-- Publie les scores et règle les marchés des matchs finis (fin estimée = coup d'envoi + 2 h).
-- Lancée après chaque import et toutes les 5 minutes par pg_cron.
create function public.appliquer_resultats()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m       record;
  v_nb    integer := 0;
  v_ordre smallint;
  v_option bigint;
begin
  -- En cours : entre le coup d'envoi et la fin estimée
  update public.matchs set statut = 'en_cours'
   where statut = 'a_venir' and date_match <= now() and date_match + interval '2 hours' > now();

  for m in
    select ma.*, l.nom as ligue_nom from public.matchs ma join public.ligues l on l.id = ma.ligue_id
     where ma.statut in ('a_venir', 'en_cours') and ma.date_match + interval '2 hours' <= now()
       and ma.statut_api in ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO', 'PST')
     for update of ma
  loop
    if m.statut_api in ('FT', 'AET', 'PEN') and m.buts_dom_api is not null and m.buts_ext_api is not null then
      update public.matchs set statut = 'termine', buts_dom = m.buts_dom_api, buts_ext = m.buts_ext_api where id = m.id;
      if m.marche_id is not null then
        v_ordre := case when m.buts_dom_api > m.buts_ext_api then 0 when m.buts_dom_api = m.buts_ext_api then 1 else 2 end;
        select id into v_option from public.options_marche where marche_id = m.marche_id and ordre = v_ordre;
        if exists (select 1 from public.marches where id = m.marche_id and statut in ('approuve', 'ferme')) then
          perform public.regler_marche_interne(m.marche_id, v_option, 'Score officiel ' || m.ligue_nom || ' : ' || m.buts_dom_api || '-' || m.buts_ext_api);
        end if;
      end if;
    else
      -- Annulé, abandonné, reporté : les mises sont remboursées
      update public.matchs set statut = case when m.statut_api = 'PST' then 'reporte' else 'annule' end where id = m.id;
      if m.marche_id is not null then
        perform public.annuler_marche_interne(m.marche_id, 'Match ' || case when m.statut_api = 'PST' then 'reporté' else 'annulé' end || ' : mises remboursées');
      end if;
    end if;
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

select cron.schedule('kongox-resultats-matchs', '*/5 * * * *', $$select public.appliquer_resultats()$$);

-- Correction manuelle d'un score par un admin (si le fournisseur se trompe ou ne répond pas)
create function public.corriger_match(p_match bigint, p_buts_dom integer, p_buts_ext integer, p_statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matchs%rowtype;
begin
  perform public.exiger_admin();
  select * into m from public.matchs where id = p_match for update;
  if not found then
    raise exception 'Match introuvable.' using hint = 'statut_invalide';
  end if;
  if m.marche_id is not null and exists (select 1 from public.marches where id = m.marche_id and statut = 'regle') then
    raise exception 'Le marché de ce match est déjà réglé.' using hint = 'deja_regle';
  end if;
  if p_statut = 'termine' then
    if p_buts_dom is null or p_buts_ext is null or p_buts_dom < 0 or p_buts_ext < 0 then
      raise exception 'Score invalide.' using hint = 'score_invalide';
    end if;
    update public.matchs set statut_api = 'FT', buts_dom_api = p_buts_dom, buts_ext_api = p_buts_ext,
           date_match = least(date_match, now() - interval '2 hours') where id = p_match;
  elsif p_statut in ('annule', 'reporte') then
    update public.matchs set statut_api = case when p_statut = 'reporte' then 'PST' else 'CANC' end,
           date_match = least(date_match, now() - interval '2 hours') where id = p_match;
  else
    raise exception 'Statut invalide.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser_detail('match_corrige', null, m.marche_id,
    jsonb_build_object('statut', m.statut, 'score', m.buts_dom_api || '-' || m.buts_ext_api),
    jsonb_build_object('statut', p_statut, 'score', p_buts_dom || '-' || p_buts_ext), jsonb_build_object('match', p_match));
  perform public.appliquer_resultats();
end;
$$;

create function public.activer_ligue(p_ligue bigint, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin();
  update public.ligues set active = p_active where id = p_ligue;
  perform public.journaliser_detail(case when p_active then 'ligue_activee' else 'ligue_desactivee' end, null, null, null, jsonb_build_object('ligue', p_ligue));
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Abonnements (suivre un pronostiqueur)
-- ---------------------------------------------------------------------
create table public.abonnements (
  suiveur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  suivi_id   uuid        not null references public.utilisateurs (id) on delete cascade,
  cree_le    timestamptz not null default now(),
  primary key (suiveur_id, suivi_id),
  constraint abonnements_pas_soi_meme check (suiveur_id <> suivi_id)
);
create index abonnements_suivi on public.abonnements (suivi_id);

create function public.suivre(p_nom text, p_suivre boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  select id into v_cible from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(p_nom));
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if v_cible = auth.uid() then
    raise exception 'On ne se suit pas soi-même.' using hint = 'soi_meme';
  end if;
  if p_suivre then
    insert into public.abonnements (suiveur_id, suivi_id) values (auth.uid(), v_cible) on conflict do nothing;
  else
    delete from public.abonnements where suiveur_id = auth.uid() and suivi_id = v_cible;
  end if;
  return p_suivre;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Communautés (villes, universités, fan-clubs) et duels
-- ---------------------------------------------------------------------
create table public.communautes (
  id          bigint generated always as identity primary key,
  nom         text        not null unique,
  type        text        not null,
  description text,
  active      boolean     not null default true,
  cree_par    uuid        references public.utilisateurs (id) on delete set null,
  cree_le     timestamptz not null default now(),
  constraint communautes_type_valide check (type in ('ville', 'universite', 'fan_club', 'autre')),
  constraint communautes_nom_longueur check (char_length(nom) between 2 and 60)
);

create table public.membres_communaute (
  communaute_id  bigint      not null references public.communautes (id) on delete cascade,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  rejoint_le     timestamptz not null default now(),
  primary key (communaute_id, utilisateur_id)
);
create index membres_communaute_utilisateur on public.membres_communaute (utilisateur_id);

create table public.duels_communautes (
  id            bigint generated always as identity primary key,
  titre         text     not null,          -- ex. « Villes »
  communaute_a  bigint   not null references public.communautes (id) on delete cascade,
  communaute_b  bigint   not null references public.communautes (id) on delete cascade,
  actif         boolean  not null default true,
  ordre         smallint not null default 0,
  constraint duels_deux_communautes check (communaute_a <> communaute_b)
);

-- Un marché peut appartenir à une communauté (filtre du fil de marchés)
alter table public.marches add column communaute_id bigint references public.communautes (id) on delete set null;

create function public.rejoindre_communaute(p_communaute bigint, p_rejoindre boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if p_rejoindre then
    if not exists (select 1 from public.communautes where id = p_communaute and active) then
      raise exception 'Communauté introuvable.' using hint = 'statut_invalide';
    end if;
    if (select count(*) from public.membres_communaute where utilisateur_id = auth.uid()) >= 3 then
      raise exception 'Trois communautés au maximum.' using hint = 'trop_de_communautes';
    end if;
    insert into public.membres_communaute (communaute_id, utilisateur_id) values (p_communaute, auth.uid()) on conflict do nothing;
  else
    delete from public.membres_communaute where communaute_id = p_communaute and utilisateur_id = auth.uid();
  end if;
end;
$$;

create function public.creer_communaute(p_nom text, p_type text, p_description text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.exiger_admin();
  insert into public.communautes (nom, type, description, cree_par)
  values (btrim(p_nom), p_type, nullif(btrim(p_description), ''), auth.uid()) returning id into v_id;
  perform public.journaliser_detail('communaute_creee', null, null, null, jsonb_build_object('communaute', v_id, 'nom', btrim(p_nom)));
  return v_id;
exception when unique_violation then
  raise exception 'Ce nom existe déjà.' using hint = 'nom_pris';
when check_violation then
  raise exception 'Nom ou type invalide.' using hint = 'statut_invalide';
end;
$$;

create function public.creer_duel(p_titre text, p_a bigint, p_b bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.exiger_admin();
  if p_a = p_b or char_length(btrim(coalesce(p_titre, ''))) < 2 then
    raise exception 'Duel invalide.' using hint = 'statut_invalide';
  end if;
  insert into public.duels_communautes (titre, communaute_a, communaute_b, ordre)
  values (btrim(p_titre), p_a, p_b, (select coalesce(max(ordre), 0) + 1 from public.duels_communautes)) returning id into v_id;
  perform public.journaliser_detail('duel_cree', null, null, null, jsonb_build_object('duel', v_id));
  return v_id;
end;
$$;

create function public.activer_duel(p_duel bigint, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin();
  update public.duels_communautes set actif = p_actif where id = p_duel;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Classements et score Mayele
-- ---------------------------------------------------------------------
-- Score Mayele = pourcentage de prédictions justes, sur les prédictions réglées
-- (gagnées ou perdues ; les remboursées ne comptent pas) dans la période.
create function public.debut_periode(p_periode text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_periode
    when 'semaine' then date_trunc('week', now() at time zone 'Africa/Kinshasa') at time zone 'Africa/Kinshasa'
    when 'mois'    then date_trunc('month', now() at time zone 'Africa/Kinshasa') at time zone 'Africa/Kinshasa'
    else '-infinity'::timestamptz
  end;
$$;

-- Toutes les lignes classées (fonction interne)
create function public.classement_complet(p_periode text, p_suivis_par uuid default null)
returns table (rang bigint, utilisateur_id uuid, nom_utilisateur text, score_mayele numeric,
               predictions_reglees bigint, predictions_gagnees bigint, solde_pieces bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with stats as (
    select p.utilisateur_id,
           count(*) as reglees,
           count(*) filter (where p.statut = 'gagnee') as gagnees
      from public.predictions p
      join public.marches m on m.id = p.marche_id
     where p.statut in ('gagnee', 'perdue') and m.regle_le >= public.debut_periode(p_periode)
       and (p_suivis_par is null or p.utilisateur_id = p_suivis_par
            or p.utilisateur_id in (select suivi_id from public.abonnements where suiveur_id = p_suivis_par))
     group by p.utilisateur_id
    having count(*) >= public.reglage('classement_min_predictions')
  )
  select row_number() over (order by s.gagnees::numeric / s.reglees desc, s.reglees desc, u.solde_pieces desc, u.nom_utilisateur),
         u.id, u.nom_utilisateur, round(100.0 * s.gagnees / s.reglees, 1), s.reglees, s.gagnees, u.solde_pieces
    from stats s join public.utilisateurs u on u.id = s.utilisateur_id;
$$;

-- p_periode : 'semaine', 'mois' ou 'tout' ; p_amis : seulement moi et les pronostiqueurs que je suis
create function public.classement(p_periode text, p_limite integer default 50, p_amis boolean default false)
returns table (rang bigint, utilisateur_id uuid, nom_utilisateur text, score_mayele numeric,
               predictions_reglees bigint, predictions_gagnees bigint, solde_pieces bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.classement_complet(p_periode, case when p_amis then auth.uid() end)
   where not p_amis or auth.uid() is not null
   order by rang limit least(greatest(coalesce(p_limite, 50), 1), 200);
$$;

-- Ma place (même si je n'ai pas encore assez de prédictions pour être classé)
create function public.mon_classement(p_periode text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'rang', (select rang from public.classement_complet(p_periode) where utilisateur_id = auth.uid()),
    'score_mayele', (select score_mayele from public.classement_complet(p_periode) where utilisateur_id = auth.uid()),
    'reglees', (select count(*) from public.predictions p join public.marches m on m.id = p.marche_id
                 where p.utilisateur_id = auth.uid() and p.statut in ('gagnee', 'perdue') and m.regle_le >= public.debut_periode(p_periode)),
    'minimum', public.reglage('classement_min_predictions'),
    'solde', (select solde_pieces from public.utilisateurs where id = auth.uid()),
    'nom', (select nom_utilisateur from public.utilisateurs where id = auth.uid())
  ) end;
$$;

-- Score Mayele d'une communauté = prédictions justes de tous ses membres ÷ prédictions réglées
create function public.duels(p_periode text)
returns table (id bigint, titre text, nom_a text, score_a numeric, nom_b text, score_b numeric, part_a integer)
language sql
stable
security definer
set search_path = ''
as $$
  with score as (
    select mc.communaute_id,
           round(100.0 * count(*) filter (where p.statut = 'gagnee') / nullif(count(*), 0), 1) as s
      from public.membres_communaute mc
      join public.predictions p on p.utilisateur_id = mc.utilisateur_id and p.statut in ('gagnee', 'perdue')
      join public.marches m on m.id = p.marche_id and m.regle_le >= public.debut_periode(p_periode)
     group by mc.communaute_id
  )
  select d.id, d.titre, a.nom, coalesce(sa.s, 0), b.nom, coalesce(sb.s, 0),
         case when coalesce(sa.s, 0) + coalesce(sb.s, 0) = 0 then 50
              else round(100 * coalesce(sa.s, 0) / (coalesce(sa.s, 0) + coalesce(sb.s, 0)))::integer end
    from public.duels_communautes d
    join public.communautes a on a.id = d.communaute_a
    join public.communautes b on b.id = d.communaute_b
    left join score sa on sa.communaute_id = d.communaute_a
    left join score sb on sb.communaute_id = d.communaute_b
   where d.actif and a.active and b.active
   order by d.ordre;
$$;


-- ---------------------------------------------------------------------
-- 9. Profils publics
-- ---------------------------------------------------------------------
create function public.profil_public(p_nom text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u public.utilisateurs%rowtype;
begin
  select * into u from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(p_nom));
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', u.id, 'nom', u.nom_utilisateur, 'role', u.role, 'badges', to_jsonb(u.badges), 'cree_le', u.cree_le,
    'solde', u.solde_pieces, 'serie', u.serie_jours,
    'predictions', (select count(*) from public.predictions where utilisateur_id = u.id),
    'reglees', (select count(*) from public.predictions where utilisateur_id = u.id and statut in ('gagnee', 'perdue')),
    'gagnees', (select count(*) from public.predictions where utilisateur_id = u.id and statut = 'gagnee'),
    'abonnes', (select count(*) from public.abonnements where suivi_id = u.id),
    'abonnements', (select count(*) from public.abonnements where suiveur_id = u.id),
    'je_suis', exists (select 1 from public.abonnements where suiveur_id = auth.uid() and suivi_id = u.id),
    'soi_meme', u.id = auth.uid(),
    'communautes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'type', c.type) order by c.nom), '[]'::jsonb)
                      from public.membres_communaute mc join public.communautes c on c.id = mc.communaute_id where mc.utilisateur_id = u.id),
    'themes', (select coalesce(jsonb_agg(jsonb_build_object('categorie', categorie, 'statut', statut)), '[]'::jsonb)
                 from public.curateurs where utilisateur_id = u.id)
  );
end;
$$;

-- Prédictions visibles sur un profil (sans montants des autres joueurs, sans données privées)
create function public.predictions_publiques(p_nom text, p_filtre text default 'toutes', p_limite integer default 20)
returns table (cree_le timestamptz, marche_id bigint, question text, categorie text, type_reponse text,
               choix text, montant bigint, statut text, gain bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.cree_le, m.id, m.question, m.categorie, m.type_reponse, o.libelle, p.montant, p.statut, p.gain
    from public.predictions p
    join public.utilisateurs u on u.id = p.utilisateur_id and lower(u.nom_utilisateur) = lower(btrim(p_nom))
    join public.marches m on m.id = p.marche_id
    join public.options_marche o on o.id = p.option_id
   where m.statut <> 'supprime'
     and (p_filtre = 'toutes' or (p_filtre = 'en_cours' and p.statut = 'en_cours') or (p_filtre = 'terminees' and p.statut <> 'en_cours'))
   order by p.cree_le desc
   limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;


-- ---------------------------------------------------------------------
-- 10. Bonus en masse : cibles « communauté » et « N premiers du classement »
-- ---------------------------------------------------------------------
drop function public.bonus_en_masse(text, text[], bigint, text);

create function public.bonus_en_masse(p_cible text, p_noms text[], p_montant bigint, p_raison text,
                                      p_communaute bigint default null, p_top integer default null, p_periode text default 'semaine')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot   uuid := gen_random_uuid();
  v_ids   uuid[];
  v_id    uuid;
  v_jours integer;
begin
  perform public.exiger_admin();
  if p_montant is null or p_montant <= 0 or p_montant > 10000 then
    raise exception 'Montant invalide (1 à 10 000 par compte).' using hint = 'montant_masse_invalide';
  end if;

  if p_cible = 'liste' then
    select array_agg(id) into v_ids from public.utilisateurs
     where lower(nom_utilisateur) in (select lower(btrim(x)) from unnest(coalesce(p_noms, '{}')) x where btrim(x) <> '')
       and id <> auth.uid();
  elsif p_cible in ('actifs_7j', 'actifs_30j') then
    v_jours := case when p_cible = 'actifs_7j' then 7 else 30 end;
    select array_agg(distinct utilisateur_id) into v_ids from public.transactions_pieces
     where type in ('bonus_quotidien', 'mise') and cree_le >= now() - make_interval(days => v_jours) and utilisateur_id <> auth.uid();
  elsif p_cible = 'communaute' then
    select array_agg(utilisateur_id) into v_ids from public.membres_communaute
     where communaute_id = p_communaute and utilisateur_id <> auth.uid();
  elsif p_cible = 'top' then
    if p_top is null or p_top not between 1 and 200 then
      raise exception 'Nombre invalide (1 à 200).' using hint = 'montant_masse_invalide';
    end if;
    select array_agg(utilisateur_id) into v_ids from public.classement_complet(p_periode)
     where rang <= p_top and utilisateur_id <> auth.uid();
  else
    raise exception 'Cible invalide.' using hint = 'statut_invalide';
  end if;

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Aucun compte ne correspond.' using hint = 'aucun_compte';
  end if;
  if cardinality(v_ids) > 5000 then
    raise exception 'Trop de comptes (5 000 maximum).' using hint = 'trop_de_comptes';
  end if;

  foreach v_id in array v_ids loop
    perform public.ajuster_pieces(v_id, p_montant, p_raison, v_lot);
  end loop;

  perform public.journaliser_detail('bonus_en_masse', null, null, null, null,
    jsonb_build_object('lot', v_lot, 'cible', p_cible, 'communaute', p_communaute, 'top', p_top, 'periode', p_periode,
                       'comptes', cardinality(v_ids), 'montant', p_montant, 'total', p_montant * cardinality(v_ids), 'raison', btrim(p_raison)));
  return jsonb_build_object('comptes', cardinality(v_ids), 'total', p_montant * cardinality(v_ids), 'lot', v_lot);
end;
$$;


-- ---------------------------------------------------------------------
-- 11. Droits d'exécution
-- ---------------------------------------------------------------------
-- Import : uniquement côté serveur avec la clé service role
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.reserver_appel_api(text)', 'public.commencer_import(text, text)',
    'public.terminer_import(bigint, text, integer, integer, text)', 'public.besoins_import()',
    'public.enregistrer_matchs(text, jsonb)', 'public.appliquer_resultats()',
    'public.regler_marche_interne(bigint, bigint, text)', 'public.annuler_marche_interne(bigint, text)',
    'public.classement_complet(text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.classement(text, integer, boolean)', 'public.duels(text)', 'public.profil_public(text)',
    'public.predictions_publiques(text, text, integer)', 'public.debut_periode(text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.mon_classement(text)', 'public.suivre(text, boolean)', 'public.rejoindre_communaute(bigint, boolean)',
    'public.corriger_match(bigint, integer, integer, text)', 'public.activer_ligue(bigint, boolean)',
    'public.creer_communaute(text, text, text)', 'public.creer_duel(text, bigint, bigint)', 'public.activer_duel(bigint, boolean)',
    'public.bonus_en_masse(text, text[], bigint, text, bigint, integer, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 12. Row Level Security
-- ---------------------------------------------------------------------
alter table public.ligues             enable row level security;
alter table public.equipes            enable row level security;
alter table public.matchs             enable row level security;
alter table public.appels_api         enable row level security;
alter table public.imports_football   enable row level security;
alter table public.abonnements        enable row level security;
alter table public.communautes        enable row level security;
alter table public.membres_communaute enable row level security;
alter table public.duels_communautes  enable row level security;

revoke all on table public.ligues, public.equipes, public.matchs, public.appels_api, public.imports_football,
                    public.abonnements, public.communautes, public.membres_communaute, public.duels_communautes
  from anon, authenticated;

-- Données publiques : matchs, ligues, équipes, abonnements, communautés
grant select on table public.ligues, public.equipes, public.matchs, public.abonnements,
                      public.communautes, public.membres_communaute, public.duels_communautes to anon, authenticated;
create policy "Ligues publiques" on public.ligues for select to anon, authenticated using (true);
create policy "Équipes publiques" on public.equipes for select to anon, authenticated using (true);
create policy "Matchs publics" on public.matchs for select to anon, authenticated using (true);
create policy "Abonnements publics" on public.abonnements for select to anon, authenticated using (true);
create policy "Communautés actives publiques" on public.communautes for select to anon, authenticated
  using (active or (select public.est_admin()));
create policy "Membres publics" on public.membres_communaute for select to anon, authenticated using (true);
create policy "Duels publics" on public.duels_communautes for select to anon, authenticated using (true);

-- Compteur et journal des imports : admins
grant select on table public.appels_api, public.imports_football to authenticated;
create policy "Appels API réservés aux admins" on public.appels_api for select to authenticated using ((select public.est_admin()));
create policy "Imports réservés aux admins" on public.imports_football for select to authenticated using ((select public.est_admin()));
