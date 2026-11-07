-- =====================================================================
-- KongoX — Communauté : invités, votes publics, icônes de profil, badges
-- =====================================================================
-- 1. Badges (table des badges, badges gagnés, attribution automatique)
-- 2. Icônes de profil (gratuites, élite, boutique) et photo perso
-- 3. Invités : vote avec un pseudo, 200 pièces d'essai, passage au compte
-- 4. Votes publics : « Qui a voté », personnes suivies qui ont voté
-- Les fonctions existantes réservées aux comptes reçoivent exiger_compte()
-- dans la deuxième partie de ce fichier (générée à partir de leur version actuelle).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Réglages et nouvelles colonnes
-- ---------------------------------------------------------------------
insert into public.reglages (cle, libelle, valeur, minimum, maximum) values
  ('bonus_invite',             'Pièces d''essai d''un invité',                          200, 0, 10000),
  ('invites_par_ip_jour',      'Invités créés au maximum par adresse IP et par jour',     3, 1, 100),
  ('invite_inactivite_jours',  'Jours sans activité avant la fermeture d''un invité',   30, 7, 365),
  ('badge_mayele_min',         'Badges Mayele : prédictions réglées minimum',            20, 1, 1000),
  ('photo_signalements_masquage', 'Signalements pour retirer une photo de profil',        3, 1, 100);

alter table public.utilisateurs
  add column invite            boolean     not null default false,   -- compte invité (pseudo seulement)
  add column ancien_invite     boolean     not null default false,   -- invité devenu membre (badge Fidèle)
  add column ferme_le          timestamptz,                            -- invité fermé après inactivité
  add column derniere_activite timestamptz not null default now(),
  add column icone             text,
  add column photo             text,                                   -- chemin dans le stockage « avatars »
  add column badges_vedette    text[]      not null default '{}';
alter table public.utilisateurs add constraint utilisateurs_vedette_max check (cardinality(badges_vedette) <= 4);
create index utilisateurs_invites_actifs on public.utilisateurs (derniere_activite) where invite and ferme_le is null;

alter table public.transactions_pieces drop constraint transactions_type_valide;
alter table public.transactions_pieces add constraint transactions_type_valide check (type in (
  'inscription', 'bonus_quotidien', 'bonus_serie', 'mise', 'gain', 'remboursement', 'question_approuvee', 'ajustement_admin',
  'essai_invite', 'achat_icone'));


create function public.est_invite(p_utilisateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select invite from public.utilisateurs where id = p_utilisateur), false) $$;

-- Réservé aux comptes : les invités reçoivent « reserve_comptes » (l'appli propose de créer un compte)
create function public.exiger_compte()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if public.est_invite(auth.uid()) then
    raise exception 'Réservé aux comptes.' using hint = 'reserve_comptes';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Badges
-- ---------------------------------------------------------------------
create table public.badges (
  code        text primary key,
  nom         text     not null,
  description text     not null,
  glyphe      text     not null,           -- dessin du badge (voir src/components/badges/)
  niveau      text     not null,
  famille     text     not null,
  condition   text     not null,
  seuil       integer  not null default 0,
  actif       boolean  not null default true,
  ordre       smallint not null default 0,
  cree_le     timestamptz not null default now(),
  constraint badges_code_format check (code ~ '^[a-z0-9_]{2,40}$'),
  constraint badges_nom_longueur check (char_length(nom) between 2 and 40),
  constraint badges_description_longueur check (char_length(description) between 5 and 160),
  constraint badges_niveau_valide check (niveau in ('bronze', 'argent', 'or')),
  constraint badges_condition_valide check (condition in ('predictions', 'serie', 'mayele', 'questions_approuvees', 'top10_semaine', 'top10_mois',
                                                          'curateur', 'parrain', 'bavard', 'fidele', 'manuel')),
  constraint badges_glyphe_valide check (glyphe ~ '^[a-z_]{2,20}$'),
  constraint badges_seuil_positif check (seuil >= 0)
);

insert into public.badges (code, nom, description, glyphe, niveau, famille, condition, seuil, ordre) values
  ('premier_vote',     'Premier vote',        'Ta toute première prédiction sur KongoX.',                       'etoile',   'bronze', 'Débuts',       'predictions',            1, 1),
  ('serie_7',          'Série de 7 jours',    'Revenir 7 jours de suite.',                                       'flamme',   'bronze', 'Séries',       'serie',                  7, 10),
  ('serie_30',         'Série de 30 jours',   'Revenir 30 jours de suite.',                                      'flamme',   'argent', 'Séries',       'serie',                 30, 11),
  ('serie_100',        'Série de 100 jours',  'Revenir 100 jours de suite.',                                     'flamme',   'or',     'Séries',       'serie',                100, 12),
  ('predictions_10',   '10 prédictions',      'Faire 10 prédictions.',                                           'cible',    'bronze', 'Prédictions',  'predictions',           10, 20),
  ('predictions_100',  '100 prédictions',     'Faire 100 prédictions.',                                          'cible',    'argent', 'Prédictions',  'predictions',          100, 21),
  ('predictions_1000', '1 000 prédictions',   'Faire 1 000 prédictions.',                                        'cible',    'or',     'Prédictions',  'predictions',         1000, 22),
  ('mayele_60',        'Mayele 60 %',         'Score Mayele de 60 % ou plus (20 prédictions réglées au moins).', 'cerveau',  'bronze', 'Mayele',       'mayele',                60, 30),
  ('mayele_70',        'Mayele 70 %',         'Score Mayele de 70 % ou plus (20 prédictions réglées au moins).', 'cerveau',  'argent', 'Mayele',       'mayele',                70, 31),
  ('mayele_80',        'Mayele 80 %',         'Score Mayele de 80 % ou plus (20 prédictions réglées au moins).', 'cerveau',  'or',     'Mayele',       'mayele',                80, 32),
  ('createur_1',       'Créateur de marché',  'Une question proposée et approuvée.',                             'plume',    'bronze', 'Créateur',     'questions_approuvees',   1, 40),
  ('createur_10',      'Créateur confirmé',   '10 questions approuvées.',                                        'plume',    'argent', 'Créateur',     'questions_approuvees',  10, 41),
  ('createur_50',      'Grand créateur',      '50 questions approuvées.',                                        'plume',    'or',     'Créateur',     'questions_approuvees',  50, 42),
  ('top10_semaine',    'Top 10 de la semaine', 'Finir une semaine dans les 10 premiers du classement.',          'podium',   'argent', 'Classement',   'top10_semaine',          0, 50),
  ('top10_mois',       'Top 10 du mois',      'Finir un mois dans les 10 premiers du classement.',               'couronne', 'or',     'Classement',   'top10_mois',             0, 51),
  ('curateur',         'Curateur',            'Choisi pour approuver les questions d''un thème.',                'bouclier', 'argent', 'Communauté',   'curateur',               0, 60),
  ('parrain_5',        'Parrain',             'Inviter 5 amis devenus membres.',                                 'mains',    'argent', 'Communauté',   'parrain',                5, 61),
  ('parrain_20',       'Grand parrain',       'Inviter 20 amis devenus membres.',                                'mains',    'or',     'Communauté',   'parrain',               20, 62),
  ('bavard',           'Bavard',              'Écrire 100 commentaires.',                                        'bulle',    'bronze', 'Communauté',   'bavard',               100, 63),
  ('fidele',           'Fidèle',              'Avoir joué en invité, puis créé son compte.',                     'coeur',    'bronze', 'Communauté',   'fidele',                 0, 64);

create table public.badges_gagnes (
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  badge_code     text        not null references public.badges (code) on update cascade on delete cascade,
  gagne_le       timestamptz not null default now(),
  vu             boolean     not null default false,      -- « Nouveau badge ! » déjà montré
  offert_par     uuid        references public.utilisateurs (id) on delete set null,
  primary key (utilisateur_id, badge_code)
);
create index badges_gagnes_non_vus on public.badges_gagnes (utilisateur_id) where not vu;

-- Nombre d'amis parrainés devenus membres : 0 jusqu'au parrainage (feat/motivation remplacera cette fonction)
create function public.nombre_parrainages(p_utilisateur uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select 0 $$;

-- Valeur actuelle d'une condition de badge pour une personne (progression : « 7/10 prédictions »)
create function public.valeur_condition_badge(p_utilisateur uuid, p_condition text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reglees integer;
  v_gagnees integer;
begin
  case p_condition
    when 'predictions' then
      return (select count(*) from public.predictions where utilisateur_id = p_utilisateur);
    when 'serie' then
      return (select serie_jours from public.utilisateurs where id = p_utilisateur);
    when 'mayele' then
      select count(*) filter (where statut in ('gagnee', 'perdue')), count(*) filter (where statut = 'gagnee')
        into v_reglees, v_gagnees from public.predictions where utilisateur_id = p_utilisateur;
      if v_reglees < public.reglage('badge_mayele_min') then
        return 0;
      end if;
      return floor(100.0 * v_gagnees / v_reglees);
    when 'questions_approuvees' then
      return (select count(*) from public.marches where auteur_id = p_utilisateur and statut in ('approuve', 'ferme', 'regle'));
    when 'curateur' then
      return (select count(*) from public.curateurs where utilisateur_id = p_utilisateur);
    when 'parrain' then
      return public.nombre_parrainages(p_utilisateur);
    when 'bavard' then
      return (select count(*) from public.messages_chat where auteur_id = p_utilisateur and not masque);
    when 'fidele' then
      return (select case when ancien_invite then 1 else 0 end from public.utilisateurs where id = p_utilisateur);
    else
      return null;   -- top 10, manuel : attribués à part
  end case;
end;
$$;

-- Donne les badges dont la condition est remplie (appelée par des déclencheurs, jamais depuis le navigateur)
create function public.verifier_badges(p_utilisateur uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  b       record;
  v_val   integer;
  v_cache jsonb := '{}';
  v_neufs text[] := '{}';
begin
  if p_utilisateur is null or exists (select 1 from public.utilisateurs where id = p_utilisateur and ferme_le is not null) then
    return v_neufs;
  end if;
  for b in
    select x.code, x.condition, x.seuil from public.badges x
     where x.actif and x.condition not in ('top10_semaine', 'top10_mois', 'manuel')
       and not exists (select 1 from public.badges_gagnes g where g.utilisateur_id = p_utilisateur and g.badge_code = x.code)
  loop
    if not v_cache ? b.condition then
      v_cache := v_cache || jsonb_build_object(b.condition, public.valeur_condition_badge(p_utilisateur, b.condition));
    end if;
    v_val := (v_cache ->> b.condition)::integer;
    if v_val >= greatest(b.seuil, 1) then
      insert into public.badges_gagnes (utilisateur_id, badge_code) values (p_utilisateur, b.code) on conflict do nothing;
      if found then
        v_neufs := v_neufs || b.code;
      end if;
    end if;
  end loop;
  return v_neufs;
end;
$$;

-- Déclencheurs : vote, règlement, série, rôle, invité devenu membre, question approuvée, commentaire
create function public.badges_apres_prediction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_badges(new.utilisateur_id);
  return null;
end;
$$;
create trigger badges_prediction_ajoutee after insert on public.predictions
  for each row execute function public.badges_apres_prediction();
create trigger badges_prediction_reglee after update of statut on public.predictions
  for each row when (old.statut = 'en_cours' and new.statut in ('gagnee', 'perdue'))
  execute function public.badges_apres_prediction();

create function public.badges_apres_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_badges(new.id);
  return null;
end;
$$;
create trigger badges_utilisateur after update of serie_jours, ancien_invite on public.utilisateurs
  for each row when (old.serie_jours is distinct from new.serie_jours or old.ancien_invite is distinct from new.ancien_invite)
  execute function public.badges_apres_utilisateur();

create function public.badges_apres_curateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_badges(new.utilisateur_id);
  return null;
end;
$$;
create trigger badges_curateur after insert on public.curateurs
  for each row execute function public.badges_apres_curateur();

create function public.badges_apres_marche()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_badges(new.auteur_id);
  return null;
end;
$$;
create trigger badges_question_approuvee after update of statut on public.marches
  for each row when (new.auteur_id is not null and new.statut = 'approuve' and old.statut is distinct from 'approuve')
  execute function public.badges_apres_marche();

create function public.badges_apres_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_badges(new.auteur_id);
  return null;
end;
$$;
create trigger badges_message after insert on public.messages_chat
  for each row execute function public.badges_apres_message();

-- Top 10 de la semaine (le dimanche) et du mois (le dernier jour), à 23 h 55, heure de Kinshasa
create function public.attribuer_badges_classement()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Africa/Kinshasa')::date;
  v_nb   integer := 0;
  n      integer;
begin
  if extract(isodow from v_jour) = 7 then
    insert into public.badges_gagnes (utilisateur_id, badge_code)
    select utilisateur_id, 'top10_semaine' from public.classement_complet('semaine') where rang <= 10
    on conflict do nothing;
    get diagnostics n = row_count;
    v_nb := v_nb + n;
  end if;
  if extract(day from v_jour + 1) = 1 then
    insert into public.badges_gagnes (utilisateur_id, badge_code)
    select utilisateur_id, 'top10_mois' from public.classement_complet('mois') where rang <= 10
    on conflict do nothing;
    get diagnostics n = row_count;
    v_nb := v_nb + n;
  end if;
  return v_nb;
end;
$$;
select cron.schedule('kongox-badges-classement', '55 22 * * *', $$select public.attribuer_badges_classement()$$);

-- Badges de la personne connectée et progression (page /badges)
create function public.progression_badges()
returns table (code text, nom text, description text, glyphe text, niveau text, famille text, condition text, seuil integer,
               valeur integer, gagne_le timestamptz, ordre smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select b.code, b.nom, b.description, b.glyphe, b.niveau, b.famille, b.condition, b.seuil,
         case when auth.uid() is null then null else public.valeur_condition_badge(auth.uid(), b.condition) end,
         g.gagne_le, b.ordre
    from public.badges b
    left join public.badges_gagnes g on g.badge_code = b.code and g.utilisateur_id = auth.uid()
   where b.actif or g.gagne_le is not null
   order by b.ordre, b.code;
$$;

-- « Nouveau badge ! » : badges pas encore montrés, puis marqués vus
create function public.badges_a_montrer()
returns table (code text, nom text, description text, glyphe text, niveau text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.code, b.nom, b.description, b.glyphe, b.niveau
    from public.badges_gagnes g join public.badges b on b.code = g.badge_code
   where g.utilisateur_id = auth.uid() and not g.vu
   order by g.gagne_le;
$$;

create function public.marquer_badges_vus()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.badges_gagnes set vu = true where utilisateur_id = auth.uid() and not vu;
$$;

-- Les 4 badges mis en avant sur le profil (parmi les siens)
create function public.choisir_badges_vedette(p_codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codes text[] := (select coalesce(array_agg(distinct c), '{}') from unnest(coalesce(p_codes, '{}')) c);
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if cardinality(v_codes) > 4 then
    raise exception 'Quatre badges au maximum.' using hint = 'hors_limites';
  end if;
  if exists (select 1 from unnest(v_codes) c where not exists (select 1 from public.badges_gagnes g where g.utilisateur_id = auth.uid() and g.badge_code = c)) then
    raise exception 'Badge non gagné.' using hint = 'badge_non_gagne';
  end if;
  update public.utilisateurs set badges_vedette = v_codes where id = auth.uid();
end;
$$;

-- Admin : créer ou modifier un badge
create function public.enregistrer_badge(p_code text, p_nom text, p_description text, p_glyphe text, p_niveau text, p_famille text,
                                         p_condition text, p_seuil integer, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant jsonb;
begin
  perform public.exiger_admin();
  select to_jsonb(b) into v_avant from public.badges b where code = p_code;
  insert into public.badges (code, nom, description, glyphe, niveau, famille, condition, seuil, actif, ordre)
  values (p_code, btrim(p_nom), btrim(p_description), p_glyphe, p_niveau, btrim(coalesce(nullif(p_famille, ''), 'Autres')), p_condition, coalesce(p_seuil, 0),
          coalesce(p_actif, true), (select coalesce(max(ordre), 0) + 1 from public.badges))
  on conflict (code) do update set nom = excluded.nom, description = excluded.description, glyphe = excluded.glyphe, niveau = excluded.niveau,
    famille = excluded.famille, condition = excluded.condition, seuil = excluded.seuil, actif = excluded.actif;
  perform public.journaliser_detail(case when v_avant is null then 'badge_cree' else 'badge_modifie' end, null, null, v_avant,
    (select to_jsonb(b) from public.badges b where code = p_code));
exception
  when check_violation then
    raise exception 'Badge invalide.' using hint = 'hors_limites';
end;
$$;

-- Admin : offrir un badge à la main
create function public.offrir_badge(p_nom_utilisateur text, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.exiger_admin();
  select id into v_id from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(ltrim(p_nom_utilisateur, '@'))) and ferme_le is null;
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if not exists (select 1 from public.badges where code = p_code) then
    raise exception 'Badge inconnu.' using hint = 'statut_invalide';
  end if;
  insert into public.badges_gagnes (utilisateur_id, badge_code, offert_par) values (v_id, p_code, auth.uid()) on conflict do nothing;
  if not found then
    raise exception 'Badge déjà gagné.' using hint = 'deja_gagne';
  end if;
  perform public.journaliser_detail('badge_offert', v_id, null, null, jsonb_build_object('badge', p_code));
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Icônes de profil et photo perso
-- ---------------------------------------------------------------------
create table public.icones (
  code         text primary key,
  nom          text     not null,
  categorie    text     not null,
  niveau       text     not null,
  prix         bigint   not null default 0,
  badge_requis text     references public.badges (code) on update cascade on delete set null,
  actif        boolean  not null default true,
  ordre        smallint not null default 0,
  constraint icones_code_format check (code ~ '^[a-z0-9_]{2,30}$'),
  constraint icones_niveau_valide check (niveau in ('gratuite', 'elite', 'boutique')),
  constraint icones_categorie_valide check (categorie in ('animaux', 'foot', 'musique', 'ville', 'masques', 'nature', 'prestige')),
  constraint icones_prix_valide check (prix between 0 and 1000000),
  constraint icones_boutique_prix check (niveau <> 'boutique' or prix > 0)
);

insert into public.icones (code, nom, categorie, niveau, prix, badge_requis, ordre) values
  -- Gratuites
  ('lion',          'Lion',            'animaux',  'gratuite',    0, null,  1),
  ('leopard',       'Léopard',         'animaux',  'gratuite',    0, null,  2),
  ('elephant',      'Éléphant',        'animaux',  'gratuite',    0, null,  3),
  ('crocodile',     'Crocodile',       'animaux',  'gratuite',    0, null,  4),
  ('gorille',       'Gorille',         'animaux',  'gratuite',    0, null,  5),
  ('perroquet',     'Perroquet gris',  'animaux',  'gratuite',    0, null,  6),
  ('tortue',        'Tortue',          'animaux',  'gratuite',    0, null,  7),
  ('okapi',         'Okapi',           'animaux',  'gratuite',    0, null,  8),
  ('ballon',        'Ballon',          'foot',     'gratuite',    0, null,  9),
  ('maillot',       'Maillot',         'foot',     'gratuite',    0, null, 10),
  ('guitare',       'Guitare',         'musique',  'gratuite',    0, null, 11),
  ('micro',         'Micro',           'musique',  'gratuite',    0, null, 12),
  ('tambour',       'Tam-tam',         'musique',  'gratuite',    0, null, 13),
  ('pirogue',       'Pirogue',         'nature',   'gratuite',    0, null, 14),
  ('palmier',       'Palmier',         'nature',   'gratuite',    0, null, 15),
  ('masque_rond',   'Masque rond',     'masques',  'gratuite',    0, null, 16),
  -- Boutique (pièces gratuites)
  ('ville',         'Kin la belle',    'ville',    'boutique',  600, null, 20),
  ('fleuve',        'Fleuve Congo',    'nature',   'boutique',  800, null, 21),
  ('masque_long',   'Masque long',     'masques',  'boutique', 1000, null, 22),
  ('cameleon',      'Caméléon',        'animaux',  'boutique', 1200, null, 23),
  ('masque_cornes', 'Masque à cornes', 'masques',  'boutique', 1500, null, 24),
  ('aigle',         'Aigle',           'animaux',  'boutique', 2000, null, 25),
  ('sapeur',        'Sapeur',          'ville',    'boutique', 2500, null, 26),
  ('diamant',       'Diamant',         'prestige', 'boutique', 5000, null, 27),
  -- Élite (badge requis)
  ('trophee',       'Trophée',         'prestige', 'elite',       0, 'top10_semaine', 30),
  ('couronne',      'Couronne',        'prestige', 'elite',       0, 'top10_mois',    31),
  ('flamme',        'Flamme',          'prestige', 'elite',       0, 'serie_30',      32),
  ('leopard_dore',  'Léopard doré',    'prestige', 'elite',       0, 'serie_100',     33),
  ('hibou',         'Hibou savant',    'prestige', 'elite',       0, 'mayele_70',     34),
  ('etoile',        'Étoile',          'prestige', 'elite',       0, 'createur_10',   35);

alter table public.utilisateurs add constraint utilisateurs_icone_fk foreign key (icone) references public.icones (code) on update cascade on delete set null;

create table public.icones_possedees (
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  icone_code     text        not null references public.icones (code) on update cascade on delete cascade,
  origine        text        not null,
  offert_par     uuid        references public.utilisateurs (id) on delete set null,
  cree_le        timestamptz not null default now(),
  primary key (utilisateur_id, icone_code),
  constraint icones_possedees_origine check (origine in ('achat', 'offerte'))
);

create function public.icone_au_hasard()
returns text
language sql
volatile
security definer
set search_path = ''
as $$ select code from public.icones where niveau = 'gratuite' and actif order by random() limit 1 $$;

-- Une personne peut-elle porter cette icône ?
create function public.peut_porter_icone(p_utilisateur uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.icones i
     where i.code = p_code
       and (exists (select 1 from public.icones_possedees p where p.utilisateur_id = p_utilisateur and p.icone_code = i.code)
            or (i.actif and i.niveau = 'gratuite')
            or (i.actif and i.niveau = 'elite' and exists (select 1 from public.badges_gagnes g where g.utilisateur_id = p_utilisateur and g.badge_code = i.badge_requis))));
$$;

-- Mes icônes : toutes, avec « je peux la porter » (page Profil › Mon icône)
create function public.mes_icones()
returns table (code text, nom text, categorie text, niveau text, prix bigint, badge_requis text, badge_nom text, disponible boolean, ordre smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select i.code, i.nom, i.categorie, i.niveau, i.prix, i.badge_requis, b.nom,
         auth.uid() is not null and public.peut_porter_icone(auth.uid(), i.code), i.ordre
    from public.icones i left join public.badges b on b.code = i.badge_requis
   where i.actif or exists (select 1 from public.icones_possedees p where p.utilisateur_id = auth.uid() and p.icone_code = i.code)
   order by i.ordre, i.code;
$$;

create function public.choisir_icone(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if not public.peut_porter_icone(auth.uid(), p_code) then
    raise exception 'Icône pas disponible.' using hint = 'icone_indisponible';
  end if;
  update public.utilisateurs set icone = p_code, photo = null where id = auth.uid();
end;
$$;

-- Achat d'une icône de la boutique, avec des pièces (mouvement_pieces, type achat_icone)
create function public.acheter_icone(p_code text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  i       public.icones%rowtype;
  v_solde bigint;
begin
  perform public.exiger_compte();
  select * into i from public.icones where code = p_code and actif and niveau = 'boutique';
  if not found then
    raise exception 'Icône pas en vente.' using hint = 'icone_indisponible';
  end if;
  -- La possession est écrite d'abord : un deuxième achat (même simultané) échoue avant tout débit
  insert into public.icones_possedees (utilisateur_id, icone_code, origine) values (auth.uid(), p_code, 'achat') on conflict do nothing;
  if not found then
    raise exception 'Icône déjà achetée.' using hint = 'deja_possedee';
  end if;
  if (select solde_pieces from public.utilisateurs where id = auth.uid() for update) < i.prix then
    raise exception 'Solde insuffisant.' using hint = 'solde_insuffisant';
  end if;
  v_solde := public.mouvement_pieces(auth.uid(), -i.prix, 'achat_icone', 'Icône « ' || i.nom || ' »');
  update public.utilisateurs set icone = p_code, photo = null where id = auth.uid();
  return v_solde;
end;
$$;

-- Admin : offrir une icône, ou changer l'icône d'une personne (la photo est retirée)
create function public.offrir_icone(p_nom_utilisateur text, p_code text, p_porter boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_avant text;
begin
  perform public.exiger_admin();
  select id, coalesce(photo, icone) into v_id, v_avant from public.utilisateurs
   where lower(nom_utilisateur) = lower(btrim(ltrim(p_nom_utilisateur, '@'))) and ferme_le is null;
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if not exists (select 1 from public.icones where code = p_code) then
    raise exception 'Icône inconnue.' using hint = 'statut_invalide';
  end if;
  insert into public.icones_possedees (utilisateur_id, icone_code, origine, offert_par) values (v_id, p_code, 'offerte', auth.uid()) on conflict do nothing;
  if p_porter then
    update public.utilisateurs set icone = p_code, photo = null where id = v_id;
  end if;
  perform public.journaliser_detail(case when p_porter then 'icone_changee' else 'icone_offerte' end, v_id, null,
    jsonb_build_object('icone', v_avant), jsonb_build_object('icone', p_code));
end;
$$;

-- Admin : prix et disponibilité d'une icône
create function public.modifier_icone(p_code text, p_prix bigint, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant jsonb;
begin
  perform public.exiger_admin();
  select jsonb_build_object('prix', prix, 'actif', actif) into v_avant from public.icones where code = p_code for update;
  if not found then
    raise exception 'Icône inconnue.' using hint = 'statut_invalide';
  end if;
  update public.icones set prix = case when niveau = 'boutique' then p_prix else prix end, actif = coalesce(p_actif, actif) where code = p_code;
  perform public.journaliser_detail('icone_modifiee', null, null, v_avant, jsonb_build_object('code', p_code, 'prix', p_prix, 'actif', p_actif));
exception
  when check_violation then
    raise exception 'Prix invalide.' using hint = 'hors_limites';
end;
$$;

-- Stockage des photos : public en lecture, 500 Ko maximum, jpg / png / webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chacun dépose, remplace ou supprime seulement les fichiers de son dossier « <son id>/… » (pas les invités)
create policy "Avatars : déposer ma photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and not (select public.est_invite((select auth.uid()))));
create policy "Avatars : remplacer ma photo" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars : supprimer ma photo" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars : lire ma photo" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Après l'envoi : la photo devient l'image de profil (le fichier doit exister dans mon dossier)
create function public.definir_photo(p_chemin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte();
  if p_chemin !~ ('^' || auth.uid()::text || '/[a-z0-9-]{1,40}\.(jpg|png|webp)$')
     or not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_chemin) then
    raise exception 'Photo invalide.' using hint = 'photo_invalide';
  end if;
  update public.utilisateurs set photo = p_chemin where id = auth.uid();
end;
$$;

create function public.retirer_ma_photo()
returns void
language sql
security definer
set search_path = ''
as $$ update public.utilisateurs set photo = null where id = auth.uid() $$;

-- Admin : retirer une photo (le fichier est effacé par le serveur) et remettre une icône
create function public.retirer_photo(p_utilisateur uuid, p_motif text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo text;
begin
  perform public.exiger_admin();
  select photo into v_photo from public.utilisateurs where id = p_utilisateur for update;
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  update public.utilisateurs set photo = null, icone = coalesce(icone, public.icone_au_hasard()) where id = p_utilisateur;
  update public.signalements set statut = 'traite', traite_par = auth.uid(), traite_le = now() where utilisateur_cible = p_utilisateur and statut = 'ouvert';
  perform public.journaliser_detail('photo_retiree', p_utilisateur, null, jsonb_build_object('photo', v_photo), jsonb_build_object('motif', p_motif));
  return v_photo;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Invités
-- ---------------------------------------------------------------------
-- Appareils des invités : un invité actif par appareil, et une limite par adresse IP.
-- Identifiant de l'appareil et adresse IP sont gardés hachés (jamais en clair).
create table public.appareils_invites (
  appareil_hash  text        primary key,
  utilisateur_id uuid        references public.utilisateurs (id) on delete cascade,
  ip_hash        text        not null,
  cree_le        timestamptz not null default now()
);
create index appareils_invites_ip on public.appareils_invites (ip_hash, cree_le desc);

-- Profil créé avec le compte Auth : icône au hasard ; invité = 200 pièces d'essai, compte = pièces d'inscription
create or replace function public.creer_profil_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom    text := new.raw_user_meta_data ->> 'nom_utilisateur';
  v_invite boolean := coalesce((new.raw_user_meta_data ->> 'invite')::boolean, false);
  v_bonus  bigint := public.reglage(case when v_invite then 'bonus_invite' else 'bonus_inscription' end);
begin
  if v_nom is null or new.email is distinct from lower(v_nom) || '@kongox.local' then
    raise exception 'Inscription refusée : le compte doit être créé depuis KongoX.';
  end if;

  insert into public.utilisateurs (id, nom_utilisateur, invite, icone) values (new.id, v_nom, v_invite, public.icone_au_hasard());
  insert into public.coordonnees_utilisateurs (utilisateur_id) values (new.id);
  if v_bonus > 0 then
    if v_invite then
      perform public.mouvement_pieces(new.id, v_bonus, 'essai_invite', 'Pièces d''essai de l''invité');
    else
      perform public.mouvement_pieces(new.id, v_bonus, 'inscription', 'Bienvenue sur KongoX : pièces offertes');
    end if;
  end if;
  return new;
end;
$$;

-- Avant de créer un invité (serveur) : appareil déjà connu ? limite de l'adresse IP ?
-- Renvoie l'invité actif de l'appareil s'il existe (le serveur reconnecte alors cet invité).
create function public.preparer_invite(p_appareil_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existant uuid;
begin
  if p_appareil_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Appareil invalide.' using hint = 'invite_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('invite:' || p_ip_hash));
  select a.utilisateur_id into v_existant
    from public.appareils_invites a join public.utilisateurs u on u.id = a.utilisateur_id
   where a.appareil_hash = p_appareil_hash and u.invite and u.ferme_le is null;
  if v_existant is not null then
    return jsonb_build_object('existant', v_existant);
  end if;
  if (select count(*) from public.appareils_invites where ip_hash = p_ip_hash and cree_le > now() - interval '24 hours')
       >= public.reglage('invites_par_ip_jour') then
    raise exception 'Trop d''invités.' using hint = 'limite_invites';
  end if;
  return jsonb_build_object('existant', null);
end;
$$;

create function public.lier_appareil_invite(p_appareil_hash text, p_ip_hash text, p_utilisateur uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.appareils_invites (appareil_hash, utilisateur_id, ip_hash) values (p_appareil_hash, p_utilisateur, p_ip_hash)
  on conflict (appareil_hash) do update set utilisateur_id = excluded.utilisateur_id, ip_hash = excluded.ip_hash, cree_le = now();
$$;

-- Invité → compte (serveur, après le choix du mot de passe) : mêmes votes, mêmes pièces, même pseudo,
-- + les pièces d'inscription. Le badge Fidèle suit (déclencheur sur ancien_invite).
create function public.convertir_invite(p_utilisateur uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solde bigint;
  v_bonus bigint := public.reglage('bonus_inscription');
begin
  perform 1 from public.utilisateurs where id = p_utilisateur and invite and ferme_le is null for update;
  if not found then
    raise exception 'Pas un invité.' using hint = 'pas_invite';
  end if;
  update public.utilisateurs set invite = false, ancien_invite = true, derniere_activite = now() where id = p_utilisateur;
  delete from public.appareils_invites where utilisateur_id = p_utilisateur;
  select solde_pieces into v_solde from public.utilisateurs where id = p_utilisateur;
  if v_bonus > 0 then
    v_solde := public.mouvement_pieces(p_utilisateur, v_bonus, 'inscription', 'Compte créé : pièces d''inscription offertes');
  end if;
  return v_solde;
end;
$$;

-- Activité : chaque mouvement de pièces (mise, gain…) repousse la fermeture d'un invité
create function public.noter_activite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.utilisateurs set derniere_activite = now()
   where id = new.utilisateur_id and derniere_activite < now() - interval '1 hour';
  return null;
end;
$$;
create trigger activite_apres_transaction after insert on public.transactions_pieces
  for each row execute function public.noter_activite();

-- Invités inactifs depuis N jours : compte fermé (pas supprimé, pour garder les mises dans les cagnottes).
-- Connexion coupée, pseudo libéré (nom technique invite_…), affiché « invité ».
create function public.fermer_invites_inactifs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.utilisateurs
   where invite and ferme_le is null and derniere_activite < now() - make_interval(days => public.reglage('invite_inactivite_jours')::integer);
  if v_ids is null then
    return 0;
  end if;
  update public.utilisateurs set ferme_le = now(), nom_utilisateur = 'invite_' || substr(replace(id::text, '-', ''), 1, 12), photo = null
   where id = any (v_ids);
  update auth.users set banned_until = '9999-12-31', email = 'ferme-' || id::text || '@invite.kongox.local' where id = any (v_ids);
  delete from auth.sessions where user_id = any (v_ids);
  delete from public.appareils_invites where utilisateur_id = any (v_ids);
  delete from public.abonnements where suivi_id = any (v_ids);
  return cardinality(v_ids);
end;
$$;
select cron.schedule('kongox-fermer-invites', '15 3 * * *', $$select public.fermer_invites_inactifs()$$);

-- Les invités (et les invités fermés) ne sont pas classés
create or replace function public.classement_complet(p_periode text, p_suivis_par uuid default null)
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
    from stats s join public.utilisateurs u on u.id = s.utilisateur_id
   where not u.invite and u.ferme_le is null;
$$;


-- ---------------------------------------------------------------------
-- 4. Votes publics
-- ---------------------------------------------------------------------
-- « Qui a voté » : chaque prédiction d'un marché visible (icône, pseudo, choix, mise, heure)
-- p_ordre : option (0 = OUI ou 1, 1 = NON ou N, 2 = 2), null = tous ; p_tri : recents | mises
create function public.votes_marche(p_marche bigint, p_ordre smallint, p_tri text, p_decalage integer, p_limite integer)
returns table (id bigint, nom text, invite boolean, icone text, photo text, elite boolean, choix text, ordre smallint,
               montant bigint, cree_le timestamptz, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         case when u.ferme_le is null then u.nom_utilisateur end,
         u.invite,
         case when u.ferme_le is null then u.icone end,
         case when u.ferme_le is null then u.photo end,
         coalesce(i.niveau = 'elite', false) and u.photo is null,
         o.libelle, o.ordre, p.montant, p.cree_le, count(*) over ()
    from public.predictions p
    join public.marches m on m.id = p.marche_id and m.statut in ('approuve', 'ferme', 'regle')
    join public.options_marche o on o.id = p.option_id
    join public.utilisateurs u on u.id = p.utilisateur_id
    left join public.icones i on i.code = u.icone
   where p.marche_id = p_marche and (p_ordre is null or o.ordre = p_ordre)
   order by case when p_tri = 'mises' then p.montant end desc nulls last, p.cree_le desc, p.id desc
   offset greatest(coalesce(p_decalage, 0), 0)
   limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;

-- Personnes que je suis qui ont voté sur ces marchés (« 12 personnes que tu suis ont voté »)
create function public.suivis_ayant_vote(p_marches bigint[])
returns table (marche_id bigint, nombre bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.marche_id, count(distinct p.utilisateur_id)
    from public.predictions p
    join public.abonnements a on a.suivi_id = p.utilisateur_id and a.suiveur_id = auth.uid()
   where p.marche_id = any (coalesce(p_marches, '{}')) and cardinality(p_marches) <= 100
   group by p.marche_id;
$$;

-- Les prédictions sont publiques (« Qui a voté », profils) : lecture pour tous
grant select on table public.predictions to anon;
create policy "Les prédictions sont publiques" on public.predictions for select to anon, authenticated using (true);

-- Profil public : icône, photo, invité, badges gagnés et mis en avant. Un invité fermé n'a plus de profil.
create or replace function public.profil_public(p_nom text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u public.utilisateurs%rowtype;
begin
  select * into u from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(p_nom)) and ferme_le is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', u.id, 'nom', u.nom_utilisateur, 'role', u.role, 'cree_le', u.cree_le, 'invite', u.invite,
    'icone', u.icone, 'photo', u.photo, 'elite', exists (select 1 from public.icones i where i.code = u.icone and i.niveau = 'elite') and u.photo is null,
    'solde', u.solde_pieces, 'serie', u.serie_jours,
    'predictions', (select count(*) from public.predictions where utilisateur_id = u.id),
    'reglees', (select count(*) from public.predictions where utilisateur_id = u.id and statut in ('gagnee', 'perdue')),
    'gagnees', (select count(*) from public.predictions where utilisateur_id = u.id and statut = 'gagnee'),
    'abonnes', (select count(*) from public.abonnements where suivi_id = u.id),
    'abonnements', (select count(*) from public.abonnements where suiveur_id = u.id),
    'je_suis', exists (select 1 from public.abonnements where suiveur_id = auth.uid() and suivi_id = u.id),
    'soi_meme', u.id = auth.uid(),
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'nom', b.nom, 'glyphe', b.glyphe, 'niveau', b.niveau,
                                                            'vedette', b.code = any (u.badges_vedette)) order by (b.code = any (u.badges_vedette)) desc, g.gagne_le desc), '[]'::jsonb)
                 from public.badges_gagnes g join public.badges b on b.code = g.badge_code where g.utilisateur_id = u.id),
    'communautes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'type', c.type) order by c.nom), '[]'::jsonb)
                      from public.membres_communaute mc join public.communautes c on c.id = mc.communaute_id where mc.utilisateur_id = u.id),
    'themes', (select coalesce(jsonb_agg(jsonb_build_object('categorie', categorie, 'statut', statut)), '[]'::jsonb)
                 from public.curateurs where utilisateur_id = u.id)
  );
end;
$$;

-- Messages du chat : l'icône de l'auteur est copiée à l'envoi (affichage en direct sans requête)
alter table public.messages_chat add column auteur_icone text, add column auteur_photo text, add column auteur_elite boolean not null default false;

-- Signalement d'une photo de profil (en plus des messages et des marchés)
alter table public.signalements add column utilisateur_cible uuid references public.utilisateurs (id) on delete cascade;
alter table public.signalements drop constraint signalements_une_cible;
alter table public.signalements add constraint signalements_une_cible check (num_nonnulls(message_id, marche_id, utilisateur_cible) = 1);
alter table public.signalements drop constraint signalements_motif_valide;
alter table public.signalements add constraint signalements_motif_valide check (motif in ('insulte', 'arnaque', 'spam', 'ligne_rouge', 'photo', 'autre'));
create unique index signalements_un_par_photo on public.signalements (utilisateur_cible, auteur_id) where utilisateur_cible is not null and statut = 'ouvert';

-- Badges déjà donnés par l'ancienne colonne « badges »
insert into public.badges_gagnes (utilisateur_id, badge_code, vu)
select id, 'createur_1', true from public.utilisateurs where 'Créateur de marché' = any (badges) on conflict do nothing;
-- Icône pour les comptes existants
update public.utilisateurs set icone = public.icone_au_hasard() where icone is null;


-- =====================================================================
-- 5. Fonctions réservées aux comptes (pas aux invités)
-- =====================================================================
-- Version actuelle de chaque fonction, avec exiger_compte() au début :
-- proposer une question, suivre, rejoindre une communauté, devenir curateur,
-- assistant IA, bonus quotidien.

-- proposer_marche
create or replace function public.proposer_marche(p_question text, p_categorie text, p_date_fin timestamptz, p_source text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := auth.uid();
  v_question text := btrim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  v_source   text := btrim(coalesce(p_source, ''));
  v_marche   bigint;
begin
  perform public.exiger_compte();
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  perform public.verifier_champs_marche(v_question, p_categorie, v_source);
  if p_date_fin is null or p_date_fin < now() + interval '24 hours' or p_date_fin > now() + interval '2 years' then
    raise exception 'Date de fin invalide.' using hint = 'date_invalide';
  end if;
  if (select count(*) from public.marches where auteur_id = v_id and statut = 'en_attente') >= public.reglage('propositions_en_attente_max') then
    raise exception 'Trop de questions en attente.' using hint = 'trop_de_propositions';
  end if;

  insert into public.marches (question, categorie, date_fin, source, auteur_id)
  values (v_question, p_categorie, p_date_fin, v_source, v_id)
  returning id into v_marche;
  insert into public.options_marche (marche_id, libelle, ordre) values (v_marche, 'OUI', 0), (v_marche, 'NON', 1);
  return v_marche;
end;
$$;

-- suivre
create or replace function public.suivre(p_nom text, p_suivre boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible uuid;
begin
  perform public.exiger_compte();
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

-- rejoindre_communaute
create or replace function public.rejoindre_communaute(p_communaute bigint, p_rejoindre boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_compte();
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

-- postuler_curateur
create or replace function public.postuler_curateur(p_categorie text, p_motivation text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid := auth.uid();
  v_texte text := btrim(coalesce(p_motivation, ''));
  v_cand bigint;
begin
  perform public.exiger_compte();
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if p_categorie not in ('football', 'musique', 'politique', 'vie_quotidienne') then
    raise exception 'Catégorie invalide.' using hint = 'categorie_invalide';
  end if;
  if char_length(v_texte) < 20 or char_length(v_texte) > 1000 then
    raise exception 'Motivation invalide.' using hint = 'motivation_invalide';
  end if;
  if exists (select 1 from public.curateurs where utilisateur_id = v_id and categorie = p_categorie) then
    raise exception 'Tu es déjà curateur dans ce thème.' using hint = 'deja_curateur';
  end if;
  if exists (select 1 from public.candidatures_curateur where utilisateur_id = v_id and categorie = p_categorie and statut = 'en_attente') then
    raise exception 'Candidature déjà envoyée.' using hint = 'candidature_en_attente';
  end if;

  insert into public.candidatures_curateur (utilisateur_id, categorie, motivation)
  values (v_id, p_categorie, v_texte) returning id into v_cand;
  return v_cand;
end;
$$;

-- reserver_question_ia
create or replace function public.reserver_question_ia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := auth.uid();
  v_jour   date := (now() at time zone 'Africa/Kinshasa')::date;
  v_limite integer := public.reglage('ia_questions_par_jour')::integer;
  v_nombre integer;
begin
  perform public.exiger_compte();
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if public.reglage('ia_active') = 0 then
    raise exception 'Assistant désactivé.' using hint = 'ia_desactivee';
  end if;

  -- Plafond global (verrou sur la ligne du jour : pas de dépassement en cas d'accès simultanés)
  insert into public.ia_usage_jour (jour) values (v_jour) on conflict (jour) do nothing;
  update public.ia_usage_jour set questions = questions + 1
   where jour = v_jour and questions < public.reglage('ia_plafond_global_jour');
  if not found then
    raise exception 'Plafond global atteint.' using hint = 'ia_plafond_global';
  end if;

  -- Limite par personne
  insert into public.ia_questions (jour, utilisateur_id, nombre) values (v_jour, v_id, 1)
  on conflict (jour, utilisateur_id) do update set nombre = public.ia_questions.nombre + 1
    where public.ia_questions.nombre < v_limite
  returning nombre into v_nombre;
  if v_nombre is null then
    -- On rend la place prise dans le plafond global
    update public.ia_usage_jour set questions = greatest(questions - 1, 0) where jour = v_jour;
    raise exception 'Limite quotidienne atteinte.' using hint = 'ia_limite_personne';
  end if;

  return v_limite - v_nombre;
end;
$$;

-- reclamer_bonus_quotidien
create or replace function public.reclamer_bonus_quotidien()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id          uuid := auth.uid();
  v_aujourdhui  date := (now() at time zone 'Africa/Kinshasa')::date;
  v_dernier     date;
  v_serie       integer;
  v_solde       bigint;
  v_bonus       bigint := public.reglage('bonus_quotidien');
  v_bonus_serie bigint := 0;
begin
  perform public.exiger_compte();
  if v_id is null then
    raise exception 'Connexion requise.';
  end if;

  select dernier_bonus_le, serie_jours, solde_pieces into v_dernier, v_serie, v_solde
    from public.utilisateurs where id = v_id for update;
  if not found then
    raise exception 'Profil introuvable.';
  end if;

  if v_dernier = v_aujourdhui then
    return jsonb_build_object('accorde', false, 'bonus', 0, 'bonus_serie', 0, 'serie_jours', v_serie, 'solde', v_solde);
  end if;

  v_serie := case when v_dernier = v_aujourdhui - 1 then v_serie + 1 else 1 end;
  update public.utilisateurs set serie_jours = v_serie, dernier_bonus_le = v_aujourdhui where id = v_id;

  -- Une transaction de bonus quotidien est écrite même à 0 : elle sert à compter les comptes actifs
  if v_bonus > 0 then
    v_solde := public.mouvement_pieces(v_id, v_bonus, 'bonus_quotidien', 'Bonus de connexion du ' || to_char(v_aujourdhui, 'DD/MM/YYYY'));
  end if;

  if v_serie % public.reglage('serie_longueur') = 0 and public.reglage('bonus_serie') > 0 then
    v_bonus_serie := public.reglage('bonus_serie');
    v_solde := public.mouvement_pieces(v_id, v_bonus_serie, 'bonus_serie', 'Série de ' || v_serie || ' jours');
  end if;

  return jsonb_build_object('accorde', true, 'bonus', v_bonus, 'bonus_serie', v_bonus_serie, 'serie_jours', v_serie, 'solde', v_solde);
end;
$$;

-- envoyer_message : réservé aux comptes, icône de l'auteur copiée
create or replace function public.envoyer_message(p_marche bigint, p_communaute bigint, p_texte text)
returns public.messages_chat
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := auth.uid();
  v_u      public.utilisateurs%rowtype;
  v_texte  text := btrim(regexp_replace(coalesce(p_texte, ''), '[\r\n]{3,}', E'\n\n', 'g'));
  v_choix  text;
  v_msg    public.messages_chat;
begin
  perform public.exiger_compte();
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  select * into v_u from public.utilisateurs where id = v_id;
  if exists (select 1 from auth.users where id = v_id and banned_until > now()) then
    raise exception 'Compte suspendu.' using hint = 'compte_suspendu';
  end if;
  if exists (select 1 from public.blocages_chat where utilisateur_id = v_id and jusqu > now()) then
    raise exception 'Chat bloqué.' using hint = 'chat_bloque';
  end if;
  if (p_marche is null) = (p_communaute is null) then
    raise exception 'Salon invalide.' using hint = 'salon_invalide';
  end if;
  if p_marche is not null and not exists (select 1 from public.marches where id = p_marche and statut in ('approuve', 'ferme', 'regle')) then
    raise exception 'Salon invalide.' using hint = 'salon_invalide';
  end if;
  if p_communaute is not null then
    if not exists (select 1 from public.communautes where id = p_communaute and active) then
      raise exception 'Salon invalide.' using hint = 'salon_invalide';
    end if;
    if not exists (select 1 from public.membres_communaute where communaute_id = p_communaute and utilisateur_id = v_id) then
      raise exception 'Réservé aux membres.' using hint = 'reserve_membres';
    end if;
  end if;
  if char_length(v_texte) < 1 or char_length(v_texte) > public.reglage('chat_longueur_max') then
    raise exception 'Longueur invalide.' using hint = 'chat_longueur';
  end if;

  -- Limites de vitesse (verrou par personne : pas de contournement par envois simultanés)
  perform pg_advisory_xact_lock(hashtext('chat:' || v_id::text));
  if exists (select 1 from public.messages_chat where auteur_id = v_id
              and cree_le > now() - make_interval(secs => public.reglage('chat_intervalle_secondes'))) then
    raise exception 'Trop vite.' using hint = 'chat_trop_vite';
  end if;
  if (select count(*) from public.messages_chat where auteur_id = v_id and cree_le > now() - interval '10 minutes')
       >= public.reglage('chat_messages_10min') then
    raise exception 'Trop de messages.' using hint = 'chat_limite';
  end if;

  -- Badge : l'option où l'auteur a le plus misé sur ce marché
  if p_marche is not null then
    select o.libelle into v_choix
      from public.predictions p join public.options_marche o on o.id = p.option_id
     where p.marche_id = p_marche and p.utilisateur_id = v_id
     group by o.libelle, o.ordre order by sum(p.montant) desc, o.ordre limit 1;
  end if;

  insert into public.messages_chat (marche_id, communaute_id, auteur_id, auteur_nom, choix, texte, auteur_icone, auteur_photo, auteur_elite)
  values (p_marche, p_communaute, v_id, v_u.nom_utilisateur, v_choix, public.filtrer_texte(v_texte), v_u.icone, v_u.photo,
          v_u.photo is null and exists (select 1 from public.icones i where i.code = v_u.icone and i.niveau = 'elite'))
  returning * into v_msg;
  return v_msg;
end;
$$;

-- creer_cadeau : pas de cadeau pour un invité
create or replace function public.creer_cadeau(p_nom_utilisateur text, p_type text, p_description text, p_sponsor text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utilisateur uuid;
  v_cadeau      bigint;
  v_sponsor     text := nullif(btrim(coalesce(p_sponsor, '')), '');
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select id into v_utilisateur from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(ltrim(p_nom_utilisateur, '@')));
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if public.est_invite(v_utilisateur) then
    raise exception 'Les invités ne reçoivent pas de cadeaux.' using hint = 'invite_sans_cadeau';
  end if;
  if p_type not in ('credit', 'forfait_internet', 'produit') then
    raise exception 'Type de cadeau invalide.' using hint = 'statut_invalide';
  end if;
  if v_sponsor is not null and char_length(v_sponsor) not between 2 and 60 then
    raise exception 'Nom du sponsor invalide.' using hint = 'hors_limites';
  end if;
  insert into public.cadeaux (utilisateur_id, type, description, sponsor, cree_par)
  values (v_utilisateur, p_type, nullif(btrim(p_description), ''), v_sponsor, auth.uid())
  returning id into v_cadeau;
  perform public.journaliser('cadeau_cree', v_utilisateur, null, jsonb_build_object('cadeau', v_cadeau, 'type', p_type, 'sponsor', v_sponsor));
  return v_cadeau;
end;
$$;

-- signaler : réservé aux comptes, et signalement d'une photo de profil (p_utilisateur).
-- Une photo signalée par N personnes est retirée automatiquement (l'icône revient).
drop function public.signaler(bigint, bigint, text, text);
create function public.signaler(p_message bigint, p_marche bigint, p_motif text, p_detail text default null, p_utilisateur uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := auth.uid();
  v_auteur uuid;
  v_nb     integer;
begin
  perform public.exiger_compte();
  if num_nonnulls(p_message, p_marche, p_utilisateur) <> 1 or p_motif not in ('insulte', 'arnaque', 'spam', 'ligne_rouge', 'photo', 'autre') then
    raise exception 'Signalement invalide.' using hint = 'signalement_invalide';
  end if;
  if p_message is not null then
    select auteur_id into v_auteur from public.messages_chat where id = p_message;
    if not found then
      raise exception 'Message introuvable.' using hint = 'signalement_invalide';
    end if;
    if v_auteur = v_id then
      raise exception 'Ton propre message.' using hint = 'soi_meme';
    end if;
  elsif p_marche is not null then
    if not exists (select 1 from public.marches where id = p_marche and statut in ('approuve', 'ferme', 'regle')) then
      raise exception 'Marché introuvable.' using hint = 'signalement_invalide';
    end if;
  else
    if p_utilisateur = v_id then
      raise exception 'Ta propre photo.' using hint = 'soi_meme';
    end if;
    if not exists (select 1 from public.utilisateurs where id = p_utilisateur and photo is not null) then
      raise exception 'Pas de photo.' using hint = 'signalement_invalide';
    end if;
  end if;
  if (select count(*) from public.signalements where auteur_id = v_id and cree_le > now() - interval '24 hours') >= 20 then
    raise exception 'Trop de signalements.' using hint = 'signalement_limite';
  end if;

  insert into public.signalements (message_id, marche_id, utilisateur_cible, auteur_id, motif, detail)
  values (p_message, p_marche, p_utilisateur, v_id, p_motif, nullif(left(btrim(coalesce(p_detail, '')), 300), ''))
  on conflict do nothing;
  if not found then
    return 'deja';
  end if;

  if p_message is not null then
    select count(*) into v_nb from public.signalements where message_id = p_message and statut <> 'rejete';
    if v_nb >= public.reglage('chat_signalements_masquage') and public.masquer_message_interne(p_message, 'signalements', null) then
      return 'masque';
    end if;
  elsif p_utilisateur is not null then
    select count(*) into v_nb from public.signalements where utilisateur_cible = p_utilisateur and statut = 'ouvert';
    if v_nb >= public.reglage('photo_signalements_masquage') then
      update public.utilisateurs set photo = null where id = p_utilisateur;
      perform public.journaliser_detail('photo_retiree_auto', p_utilisateur, null, null, jsonb_build_object('signalements', v_nb));
      return 'masque';
    end if;
  end if;
  return 'enregistre';
end;
$$;


-- =====================================================================
-- 6. Droits et Row Level Security
-- =====================================================================
do $$
declare
  f text;
begin
  -- Internes ou serveur (clé service role) seulement
  foreach f in array array['public.verifier_badges(uuid)', 'public.valeur_condition_badge(uuid, text)', 'public.nombre_parrainages(uuid)',
                           'public.attribuer_badges_classement()', 'public.badges_apres_prediction()', 'public.badges_apres_utilisateur()',
                           'public.badges_apres_curateur()', 'public.badges_apres_marche()', 'public.badges_apres_message()',
                           'public.icone_au_hasard()', 'public.preparer_invite(text, text)', 'public.lier_appareil_invite(text, text, uuid)',
                           'public.convertir_invite(uuid)', 'public.noter_activite()', 'public.fermer_invites_inactifs()',
                           'public.peut_porter_icone(uuid, text)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- Tout le monde (visiteurs compris)
  foreach f in array array['public.progression_badges()', 'public.mes_icones()', 'public.votes_marche(bigint, smallint, text, integer, integer)',
                           'public.est_invite(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  -- Comptes connectés (invités compris ; les fonctions vérifient elles-mêmes)
  foreach f in array array['public.badges_a_montrer()', 'public.marquer_badges_vus()', 'public.choisir_badges_vedette(text[])',
                           'public.enregistrer_badge(text, text, text, text, text, text, text, integer, boolean)', 'public.offrir_badge(text, text)',
                           'public.choisir_icone(text)', 'public.acheter_icone(text)', 'public.offrir_icone(text, text, boolean)',
                           'public.modifier_icone(text, bigint, boolean)', 'public.definir_photo(text)', 'public.retirer_ma_photo()',
                           'public.retirer_photo(uuid, text)', 'public.suivis_ayant_vote(bigint[])', 'public.exiger_compte()',
                           'public.signaler(bigint, bigint, text, text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

alter table public.badges            enable row level security;
alter table public.badges_gagnes     enable row level security;
alter table public.icones            enable row level security;
alter table public.icones_possedees  enable row level security;
alter table public.appareils_invites enable row level security;
revoke all on table public.badges, public.badges_gagnes, public.icones, public.icones_possedees, public.appareils_invites from anon, authenticated;

grant select on table public.badges to anon, authenticated;
create policy "Badges publics" on public.badges for select to anon, authenticated using (true);
grant select on table public.badges_gagnes to anon, authenticated;
create policy "Badges gagnés publics" on public.badges_gagnes for select to anon, authenticated using (true);
grant select on table public.icones to anon, authenticated;
create policy "Icônes publiques" on public.icones for select to anon, authenticated using (true);
grant select on table public.icones_possedees to authenticated;
create policy "Mes icônes, ou toutes pour les admins" on public.icones_possedees for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));
-- appareils_invites : aucune lecture depuis le navigateur (serveur seulement)


-- traiter_signalement : les signalements de photo sont clos ensemble aussi
create or replace function public.traiter_signalement(p_signalement bigint, p_statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.signalements%rowtype;
begin
  perform public.exiger_admin();
  if p_statut not in ('traite', 'rejete') then
    raise exception 'Statut invalide.' using hint = 'statut_invalide';
  end if;
  select * into s from public.signalements where id = p_signalement for update;
  if not found then
    raise exception 'Signalement introuvable.' using hint = 'statut_invalide';
  end if;
  -- Tous les signalements ouverts de la même cible sont clos ensemble
  update public.signalements set statut = p_statut, traite_par = auth.uid(), traite_le = now()
   where statut = 'ouvert' and (message_id = s.message_id or marche_id = s.marche_id or utilisateur_cible = s.utilisateur_cible);
  perform public.journaliser_detail('signalement_' || p_statut, null, s.marche_id, null,
    jsonb_build_object('signalement', p_signalement, 'message', s.message_id, 'photo_de', s.utilisateur_cible));
end;
$$;

-- Rattrapage : badges déjà mérités par les comptes existants
select count(*) from (select public.verifier_badges(id) from public.utilisateurs where ferme_le is null) x;
