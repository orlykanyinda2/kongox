-- =====================================================================
-- KongoX — Étape 3 (suite) : back-office admin
-- =====================================================================
-- Réglages modifiables, marchés créés par l'admin (brouillon → programmé →
-- en ligne → fermé → réglé), suppression avec remboursement, programmation
-- et marchés récurrents, ajustements de pièces, journal avant / après,
-- chiffres du tableau de bord.
-- Statut « en ligne » = 'approuve' dans la base (nom gardé pour ne pas casser
-- les fonctions des étapes 2 et 3).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages (règles des pièces modifiables par un admin)
-- ---------------------------------------------------------------------
create table public.reglages (
  cle         text primary key,
  libelle     text   not null,
  valeur      bigint,             -- réglage numérique
  texte       text,               -- réglage texte
  minimum     bigint,
  maximum     bigint,
  modifie_par uuid   references public.utilisateurs (id) on delete set null,
  modifie_le  timestamptz not null default now(),
  constraint reglages_un_type check ((valeur is null) <> (texte is null)),
  constraint reglages_bornes check (valeur is null or ((minimum is null or valeur >= minimum) and (maximum is null or valeur <= maximum)))
);

insert into public.reglages (cle, libelle, valeur, minimum, maximum) values
  ('bonus_inscription',           'Pièces offertes à l''inscription',                       1000, 0, 10000),
  ('bonus_quotidien',             'Bonus de connexion quotidien',                           100,  0, 1000),
  ('serie_longueur',              'Jours de suite pour le bonus de série',                  7,    2, 30),
  ('bonus_serie',                 'Bonus de série',                                         200,  0, 5000),
  ('bonus_question_approuvee',    'Pièces pour une question approuvée',                     50,   0, 1000),
  ('limite_mise_quotidienne',     'Limite de pièces misées par jour',                       2000, 10, 100000),
  ('mise_minimum',                'Mise minimum',                                           10,   1, 1000),
  ('seuil_essai_curateur',        'Décisions validées pour qu''un curateur soit autonome',  10,   1, 100),
  ('propositions_en_attente_max', 'Questions en attente par personne (maximum)',            5,    1, 50),
  ('ajustement_max',              'Ajustement de pièces maximum (par compte)',               100000, 1, 10000000);

insert into public.reglages (cle, libelle, texte) values
  ('whatsapp_equipe', 'Numéro WhatsApp de l''équipe (ex. 243812345678)', '');

-- Lecture d'un réglage numérique
create function public.reglage(p_cle text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select valeur from public.reglages where cle = p_cle;
$$;

create function public.modifier_reglage(p_cle text, p_valeur bigint, p_texte text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reglages%rowtype;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select * into r from public.reglages where cle = p_cle for update;
  if not found then
    raise exception 'Réglage inconnu.' using hint = 'statut_invalide';
  end if;
  if r.valeur is not null then
    if p_valeur is null or (r.minimum is not null and p_valeur < r.minimum) or (r.maximum is not null and p_valeur > r.maximum) then
      raise exception 'Valeur hors limites.' using hint = 'hors_limites';
    end if;
    update public.reglages set valeur = p_valeur, modifie_par = auth.uid(), modifie_le = now() where cle = p_cle;
  else
    if p_texte is not null and p_cle = 'whatsapp_equipe' and btrim(p_texte) !~ '^[0-9]{0,15}$' then
      raise exception 'Numéro invalide.' using hint = 'hors_limites';
    end if;
    update public.reglages set texte = btrim(coalesce(p_texte, '')), modifie_par = auth.uid(), modifie_le = now() where cle = p_cle;
  end if;
  perform public.journaliser_detail('reglage_modifie', null, null,
    jsonb_build_object('cle', p_cle, 'valeur', coalesce(r.valeur::text, r.texte)),
    jsonb_build_object('cle', p_cle, 'valeur', coalesce(p_valeur::text, btrim(coalesce(p_texte, '')))));
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Journal : avant / après, et fusion avec les modifications détectées
-- ---------------------------------------------------------------------
alter table public.journal_admin
  add column avant jsonb,
  add column apres jsonb,
  add column txid  bigint not null default txid_current();

create index journal_admin_action on public.journal_admin (action, cree_le desc);
create index journal_admin_auteur on public.journal_admin (auteur_id, cree_le desc);

-- Écrit une ligne complète (avec avant / après)
create function public.journaliser_detail(p_action text, p_utilisateur uuid, p_marche bigint, p_avant jsonb, p_apres jsonb, p_details jsonb default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.journal_admin (auteur_id, action, cible_utilisateur, cible_marche, avant, apres, details)
  values (auth.uid(), p_action, p_utilisateur, p_marche, p_avant, p_apres, p_details);
$$;

-- journaliser() (étape 3) devient « intelligent » : si un déclencheur vient d'enregistrer
-- une modification de la même cible dans la même transaction, on lui donne son vrai nom
-- (ex. « marche_approuve ») au lieu d'écrire une deuxième ligne.
drop function public.journaliser(text, uuid, bigint, jsonb);
create function public.journaliser(p_action text, p_utilisateur uuid default null, p_marche bigint default null, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  select id into v_id from public.journal_admin
   where txid = txid_current() and action = 'modification'
     and ((p_marche is not null and cible_marche = p_marche)
          or (p_marche is null and p_utilisateur is not null and cible_utilisateur = p_utilisateur))
   order by id desc limit 1;

  if v_id is not null then
    update public.journal_admin
       set action = p_action, details = coalesce(p_details, details), cible_utilisateur = coalesce(p_utilisateur, cible_utilisateur)
     where id = v_id;
  else
    insert into public.journal_admin (auteur_id, action, cible_utilisateur, cible_marche, details)
    values (auth.uid(), p_action, p_utilisateur, p_marche, p_details);
  end if;
end;
$$;

-- Déclencheur : enregistre avant / après des colonnes modifiées d'un marché,
-- seulement pour les actions faites par une personne (pas par pg_cron).
create function public.journal_modification_marche()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant jsonb := '{}';
  v_apres jsonb := '{}';
  c       text;
  a       jsonb := to_jsonb(old);
  n       jsonb := to_jsonb(new);
begin
  if auth.uid() is null then
    return new;
  end if;
  foreach c in array array['question', 'categorie', 'source', 'date_fin', 'date_publication', 'statut', 'soki_du_jour',
                           'soki_programme', 'mis_en_avant', 'option_gagnante_id', 'lien_resultat', 'motif'] loop
    if a -> c is distinct from n -> c then
      v_avant := v_avant || jsonb_build_object(c, a -> c);
      v_apres := v_apres || jsonb_build_object(c, n -> c);
    end if;
  end loop;
  if v_avant <> '{}' then
    -- Le règlement et l'annulation (fonctions de l'étape 2) gardent leur propre nom d'action
    insert into public.journal_admin (auteur_id, action, cible_marche, avant, apres)
    values (auth.uid(),
            case when new.statut = 'regle' and old.statut <> 'regle'
                 then case when new.option_gagnante_id is null then 'marche_annule' else 'marche_regle' end
                 else 'modification' end,
            new.id, v_avant, v_apres);
  end if;
  return new;
end;
$$;

-- Même chose pour le rôle et les badges d'un utilisateur
create function public.journal_modification_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or (old.role is not distinct from new.role and old.badges is not distinct from new.badges) then
    return new;
  end if;
  insert into public.journal_admin (auteur_id, action, cible_utilisateur, avant, apres)
  values (auth.uid(), 'modification', new.id,
          jsonb_build_object('role', old.role, 'badges', old.badges),
          jsonb_build_object('role', new.role, 'badges', new.badges));
  return new;
end;
$$;

create trigger utilisateurs_journal_modification
  after update of role, badges on public.utilisateurs
  for each row execute function public.journal_modification_utilisateur();

-- Le déclencheur de l'étape 3 sur le règlement devient inutile (remplacé par le suivant)
drop trigger marches_journal_reglement on public.marches;
drop function public.journaliser_reglement();


-- ---------------------------------------------------------------------
-- 3. Marchés : nouveaux statuts et colonnes
-- ---------------------------------------------------------------------
create table public.modeles_recurrents (
  id                    bigint generated always as identity primary key,
  question_modele       text        not null,   -- peut contenir {date} (date de publication, ex. 12/12/2026)
  categorie             text        not null,
  source                text        not null,
  frequence             text        not null,
  jour_semaine          smallint,                -- 1 = lundi … 7 = dimanche (hebdomadaire)
  heure_publication     time        not null,    -- heure de Kinshasa
  duree_heures          integer     not null,    -- ouverture du marché après publication
  soki                  boolean     not null default false,
  actif                 boolean     not null default true,
  prochaine_publication timestamptz not null,
  cree_par              uuid        references public.utilisateurs (id) on delete set null,
  cree_le               timestamptz not null default now(),
  constraint modeles_question_longueur check (char_length(question_modele) between 15 and 200),
  constraint modeles_categorie_valide check (categorie in ('football', 'musique', 'politique', 'vie_quotidienne')),
  constraint modeles_frequence_valide check (frequence in ('quotidienne', 'hebdomadaire')),
  constraint modeles_jour_valide check ((frequence = 'hebdomadaire') = (jour_semaine between 1 and 7)),
  constraint modeles_duree_valide check (duree_heures between 1 and 24 * 365)
);

alter table public.marches drop constraint marches_statut_valide;
alter table public.marches add constraint marches_statut_valide check (
  statut in ('brouillon', 'programme', 'en_attente', 'approuve', 'refuse', 'ferme', 'regle', 'supprime')
);
alter table public.marches
  add column date_publication timestamptz,
  add column soki_programme   boolean not null default false,  -- devient Soki du jour à la publication
  add column mis_en_avant     boolean not null default false,
  add column cree_par         uuid references public.utilisateurs (id) on delete set null,
  add column modele_id        bigint references public.modeles_recurrents (id) on delete set null;

create index marches_publication on public.marches (statut, date_publication);

create trigger marches_journal_modification
  after update on public.marches
  for each row execute function public.journal_modification_marche();


-- ---------------------------------------------------------------------
-- 4. Les fonctions existantes lisent maintenant les réglages
-- ---------------------------------------------------------------------
create or replace function public.limite_mise_quotidienne()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select public.reglage('limite_mise_quotidienne') $$;

create or replace function public.seuil_essai_curateur()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select public.reglage('seuil_essai_curateur')::integer $$;

create or replace function public.creer_profil_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom   text := new.raw_user_meta_data ->> 'nom_utilisateur';
  v_bonus bigint := public.reglage('bonus_inscription');
begin
  if v_nom is null or new.email is distinct from lower(v_nom) || '@kongox.local' then
    raise exception 'Inscription refusée : le compte doit être créé depuis KongoX.';
  end if;

  insert into public.utilisateurs (id, nom_utilisateur) values (new.id, v_nom);
  insert into public.coordonnees_utilisateurs (utilisateur_id) values (new.id);
  if v_bonus > 0 then
    perform public.mouvement_pieces(new.id, v_bonus, 'inscription', 'Bienvenue sur KongoX : pièces offertes');
  end if;
  return new;
end;
$$;

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

create or replace function public.appliquer_approbation(p_marche bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche public.marches%rowtype;
  v_bonus  bigint := public.reglage('bonus_question_approuvee');
begin
  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut <> 'en_attente' then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;

  update public.marches set statut = 'approuve', examine_par = auth.uid(), examine_le = now(),
         date_publication = coalesce(date_publication, now())
   where id = p_marche;

  if v_marche.auteur_id is not null then
    if v_bonus > 0 then
      perform public.mouvement_pieces(v_marche.auteur_id, v_bonus, 'question_approuvee',
                                      'Question approuvée : ' || v_marche.question, p_marche);
    end if;
    update public.utilisateurs
       set badges = array_append(badges, 'Créateur de marché')
     where id = v_marche.auteur_id and not ('Créateur de marché' = any (badges));
  end if;
end;
$$;

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

create or replace function public.placer_prediction(p_marche bigint, p_option bigint, p_montant bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := auth.uid();
  v_marche  public.marches%rowtype;
  v_solde   bigint;
  v_deja    bigint;
  v_libelle text;
  v_pred    bigint;
  v_limite  bigint := public.limite_mise_quotidienne();
begin
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if p_montant is null or p_montant < public.reglage('mise_minimum') then
    raise exception 'Montant invalide.' using hint = 'montant_invalide', detail = public.reglage('mise_minimum')::text;
  end if;

  select * into v_marche from public.marches where id = p_marche for share;
  if not found or v_marche.statut <> 'approuve' or v_marche.date_fin <= now() then
    raise exception 'Ce marché est fermé.' using hint = 'marche_ferme';
  end if;

  select libelle into v_libelle from public.options_marche where id = p_option and marche_id = p_marche;
  if not found then
    raise exception 'Option invalide.' using hint = 'option_invalide';
  end if;

  select solde_pieces into v_solde from public.utilisateurs where id = v_id for update;
  if not found then
    raise exception 'Profil introuvable.' using hint = 'connexion_requise';
  end if;

  v_deja := public.mises_du_jour(v_id);
  if v_deja + p_montant > v_limite then
    raise exception 'Limite quotidienne atteinte.' using hint = 'limite_quotidienne', detail = greatest(v_limite - v_deja, 0)::text;
  end if;
  if v_solde < p_montant then
    raise exception 'Solde insuffisant.' using hint = 'solde_insuffisant';
  end if;

  v_solde := public.mouvement_pieces(v_id, -p_montant, 'mise', v_libelle || ' : ' || v_marche.question, p_marche);
  update public.options_marche set total_mise = total_mise + p_montant where id = p_option;
  insert into public.predictions (utilisateur_id, marche_id, option_id, montant)
  values (v_id, p_marche, p_option, p_montant) returning id into v_pred;

  return jsonb_build_object('prediction_id', v_pred, 'solde', v_solde, 'restant_aujourdhui', v_limite - v_deja - p_montant);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Marchés créés et gérés par l'admin
-- ---------------------------------------------------------------------
-- Vérifications communes (question, catégorie, source)
create function public.verifier_champs_marche(p_question text, p_categorie text, p_source text)
returns void
language plpgsql
immutable
as $$
begin
  if char_length(coalesce(p_question, '')) < 15 or char_length(p_question) > 200 or right(p_question, 1) <> '?' then
    raise exception 'Question invalide.' using hint = 'question_invalide';
  end if;
  if p_categorie is null or p_categorie not in ('football', 'musique', 'politique', 'vie_quotidienne') then
    raise exception 'Catégorie invalide.' using hint = 'categorie_invalide';
  end if;
  if char_length(coalesce(p_source, '')) < 3 or char_length(p_source) > 200 then
    raise exception 'Source invalide.' using hint = 'source_invalide';
  end if;
end;
$$;

create function public.exiger_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
end;
$$;

-- p_etat : 'brouillon', 'programme' (avec p_date_publication) ou 'en_ligne'
create function public.creer_marche_admin(
  p_question text, p_categorie text, p_source text, p_date_fin timestamptz,
  p_etat text, p_date_publication timestamptz default null,
  p_mis_en_avant boolean default false, p_soki_programme boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question text := btrim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  v_source   text := btrim(coalesce(p_source, ''));
  v_debut    timestamptz;
  v_statut   text;
  v_marche   bigint;
begin
  perform public.exiger_admin();
  perform public.verifier_champs_marche(v_question, p_categorie, v_source);

  if p_etat = 'brouillon' then
    v_statut := 'brouillon';
    v_debut := coalesce(p_date_publication, now());
  elsif p_etat = 'programme' then
    if p_date_publication is null or p_date_publication <= now() then
      raise exception 'La date de publication doit être dans le futur.' using hint = 'date_publication_invalide';
    end if;
    v_statut := 'programme';
    v_debut := p_date_publication;
  elsif p_etat = 'en_ligne' then
    v_statut := 'approuve';
    v_debut := now();
  else
    raise exception 'État invalide.' using hint = 'statut_invalide';
  end if;

  if p_date_fin is null or p_date_fin < v_debut + interval '1 hour' or p_date_fin > v_debut + interval '2 years' then
    raise exception 'Date de fin invalide.' using hint = 'date_invalide';
  end if;

  insert into public.marches (question, categorie, source, date_fin, statut, date_publication, mis_en_avant,
                              soki_programme, cree_par, examine_par, examine_le)
  values (v_question, p_categorie, v_source, p_date_fin, v_statut,
          case when v_statut = 'brouillon' then p_date_publication else v_debut end,
          coalesce(p_mis_en_avant, false), coalesce(p_soki_programme, false),
          auth.uid(), auth.uid(), now())
  returning id into v_marche;
  insert into public.options_marche (marche_id, libelle, ordre) values (v_marche, 'OUI', 0), (v_marche, 'NON', 1);

  if v_statut = 'approuve' and p_soki_programme then
    update public.marches set soki_du_jour = false where soki_du_jour;
    update public.marches set soki_du_jour = true where id = v_marche;
  end if;

  perform public.journaliser_detail('marche_cree', null, v_marche, null,
    jsonb_build_object('question', v_question, 'statut', v_statut, 'date_publication', v_debut, 'date_fin', p_date_fin));
  return v_marche;
end;
$$;

-- Modifier un marché. Tant qu'il n'y a aucune mise : tout. Après la première mise :
-- seulement la date de fin, la mise en avant (et le Soki via definir_soki_du_jour).
create function public.modifier_marche_admin(
  p_marche bigint, p_question text, p_categorie text, p_source text, p_date_fin timestamptz,
  p_date_publication timestamptz, p_mis_en_avant boolean, p_soki_programme boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          public.marches%rowtype;
  v_question text := btrim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  v_source   text := btrim(coalesce(p_source, ''));
  v_mises    boolean;
begin
  perform public.exiger_admin();
  select * into m from public.marches where id = p_marche for update;
  if not found or m.statut in ('regle', 'supprime', 'refuse') then
    raise exception 'Ce marché ne peut plus être modifié.' using hint = 'statut_invalide';
  end if;
  perform public.verifier_champs_marche(v_question, p_categorie, v_source);
  v_mises := exists (select 1 from public.predictions where marche_id = p_marche);

  -- (la date de publication ne compte pas : elle ne change plus une fois le marché en ligne)
  if v_mises and (v_question <> m.question or p_categorie <> m.categorie or v_source <> m.source) then
    raise exception 'Des pièces sont déjà misées : seules la date de fin et la mise en avant peuvent changer.' using hint = 'verrouille_mises';
  end if;
  if p_date_fin is null or p_date_fin < now() + interval '10 minutes' or p_date_fin > now() + interval '2 years' then
    raise exception 'Date de fin invalide.' using hint = 'date_invalide';
  end if;
  if m.statut = 'programme' and (p_date_publication is null or p_date_publication <= now()) then
    raise exception 'La date de publication doit être dans le futur.' using hint = 'date_publication_invalide';
  end if;
  if p_date_publication is not null and m.statut in ('brouillon', 'programme') and p_date_fin < p_date_publication + interval '1 hour' then
    raise exception 'La fin doit être au moins 1 h après la publication.' using hint = 'date_invalide';
  end if;

  update public.marches
     set question = v_question, categorie = p_categorie, source = v_source, date_fin = p_date_fin,
         date_publication = case when statut in ('brouillon', 'programme', 'en_attente') then p_date_publication else date_publication end,
         mis_en_avant = coalesce(p_mis_en_avant, false), soki_programme = coalesce(p_soki_programme, false)
   where id = p_marche;
  perform public.journaliser('marche_modifie_admin', null, p_marche);
end;
$$;

-- Changer l'état : 'publier' (en ligne tout de suite), 'programmer', 'brouillon', 'fermer'
create function public.changer_etat_marche(p_marche bigint, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.marches%rowtype;
begin
  perform public.exiger_admin();
  select * into m from public.marches where id = p_marche for update;
  if not found then
    raise exception 'Marché introuvable.' using hint = 'statut_invalide';
  end if;

  if p_action = 'publier' and m.statut in ('brouillon', 'programme') then
    if m.date_fin < now() + interval '1 hour' then
      raise exception 'La date de fin est trop proche : modifie-la d''abord.' using hint = 'date_invalide';
    end if;
    update public.marches set statut = 'approuve', date_publication = now(), examine_par = auth.uid(), examine_le = now() where id = p_marche;
    if m.soki_programme then
      update public.marches set soki_du_jour = false where soki_du_jour and id <> p_marche;
      update public.marches set soki_du_jour = true where id = p_marche;
    end if;
  elsif p_action = 'programmer' and m.statut = 'brouillon' then
    if m.date_publication is null or m.date_publication <= now() then
      raise exception 'Choisis d''abord une date de publication dans le futur.' using hint = 'date_publication_invalide';
    end if;
    update public.marches set statut = 'programme' where id = p_marche;
  elsif p_action = 'brouillon' and m.statut = 'programme' then
    update public.marches set statut = 'brouillon' where id = p_marche;
  elsif p_action = 'fermer' and m.statut = 'approuve' then
    update public.marches set statut = 'ferme', date_fin = least(date_fin, now()) where id = p_marche;
  else
    raise exception 'Action impossible dans cet état.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser('marche_' || p_action, null, p_marche);
end;
$$;

create function public.mettre_en_avant(p_marche bigint, p_valeur boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin();
  update public.marches set mis_en_avant = p_valeur where id = p_marche and statut not in ('supprime', 'refuse');
  if not found then
    raise exception 'Marché introuvable.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser(case when p_valeur then 'marche_mis_en_avant' else 'marche_retire_avant' end, null, p_marche);
end;
$$;

-- Dupliquer : copie en brouillon, même durée d'ouverture
create function public.dupliquer_marche(p_marche bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  m        public.marches%rowtype;
  v_duree  interval;
  v_nouveau bigint;
begin
  perform public.exiger_admin();
  select * into m from public.marches where id = p_marche;
  if not found then
    raise exception 'Marché introuvable.' using hint = 'statut_invalide';
  end if;
  v_duree := greatest(m.date_fin - coalesce(m.date_publication, m.cree_le), interval '1 day');

  insert into public.marches (question, categorie, source, date_fin, statut, cree_par, mis_en_avant)
  values (m.question, m.categorie, m.source, now() + v_duree, 'brouillon', auth.uid(), false)
  returning id into v_nouveau;
  insert into public.options_marche (marche_id, libelle, ordre) values (v_nouveau, 'OUI', 0), (v_nouveau, 'NON', 1);
  perform public.journaliser_detail('marche_duplique', null, v_nouveau, null, jsonb_build_object('copie_de', p_marche));
  return v_nouveau;
end;
$$;

-- Supprimer : le marché disparaît partout et toutes les mises en cours sont remboursées.
-- (On ne l'efface jamais vraiment : le journal des pièces pointe vers lui.)
create function public.supprimer_marche(p_marche bigint, p_motif text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m      public.marches%rowtype;
  v_nb   integer;
begin
  perform public.exiger_admin();
  if char_length(btrim(coalesce(p_motif, ''))) < 3 then
    raise exception 'Motif obligatoire.' using hint = 'motif_obligatoire';
  end if;
  select * into m from public.marches where id = p_marche for update;
  if not found or m.statut in ('regle', 'supprime') then
    raise exception 'Ce marché ne peut pas être supprimé.' using hint = 'statut_invalide';
  end if;

  select count(*) into v_nb from public.predictions where marche_id = p_marche and statut = 'en_cours';
  update public.marches set statut = 'supprime', soki_du_jour = false, mis_en_avant = false,
         motif = btrim(p_motif), regle_le = now()
   where id = p_marche;
  perform public.rembourser_marche(p_marche, m.question);
  perform public.journaliser('marche_supprime', null, p_marche, jsonb_build_object('mises_remboursees', v_nb, 'motif', btrim(p_motif)));
  return v_nb;
end;
$$;

-- Nombre de mises en cours (pour la fenêtre de confirmation)
create function public.mises_en_cours(p_marche bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin();
  return (select jsonb_build_object('mises', count(*), 'pieces', coalesce(sum(montant), 0))
            from public.predictions where marche_id = p_marche and statut = 'en_cours');
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Publication automatique et marchés récurrents (pg_cron)
-- ---------------------------------------------------------------------
create function public.creer_modele_recurrent(
  p_question text, p_categorie text, p_source text, p_frequence text, p_jour_semaine smallint,
  p_heure time, p_duree_heures integer, p_soki boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question  text := btrim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  v_source    text := btrim(coalesce(p_source, ''));
  v_modele    bigint;
begin
  perform public.exiger_admin();
  perform public.verifier_champs_marche(replace(v_question, '{date}', '01/01/2027'), p_categorie, v_source);
  if p_frequence not in ('quotidienne', 'hebdomadaire') or (p_frequence = 'hebdomadaire' and (p_jour_semaine is null or p_jour_semaine not between 1 and 7)) then
    raise exception 'Fréquence invalide.' using hint = 'frequence_invalide';
  end if;
  if p_heure is null or p_duree_heures is null or p_duree_heures not between 1 and 24 * 365 then
    raise exception 'Heure ou durée invalide.' using hint = 'frequence_invalide';
  end if;

  insert into public.modeles_recurrents (question_modele, categorie, source, frequence, jour_semaine, heure_publication,
                                         duree_heures, soki, prochaine_publication, cree_par)
  values (v_question, p_categorie, v_source, p_frequence,
          case when p_frequence = 'hebdomadaire' then p_jour_semaine end, p_heure, p_duree_heures, coalesce(p_soki, false),
          public.prochaine_occurrence(p_frequence, case when p_frequence = 'hebdomadaire' then p_jour_semaine end, p_heure, now()),
          auth.uid())
  returning id into v_modele;
  perform public.journaliser_detail('modele_cree', null, null, null, jsonb_build_object('modele', v_modele, 'question', v_question));
  return v_modele;
end;
$$;

-- Prochaine date (après p_apres) pour une fréquence et une heure de Kinshasa
create function public.prochaine_occurrence(p_frequence text, p_jour_semaine smallint, p_heure time, p_apres timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_jour date := (p_apres at time zone 'Africa/Kinshasa')::date;
  v_t    timestamptz;
begin
  loop
    v_t := (v_jour + p_heure) at time zone 'Africa/Kinshasa';
    if v_t > p_apres and (p_frequence = 'quotidienne' or extract(isodow from v_jour) = p_jour_semaine) then
      return v_t;
    end if;
    v_jour := v_jour + 1;
  end loop;
end;
$$;

create function public.activer_modele(p_modele bigint, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  md public.modeles_recurrents%rowtype;
begin
  perform public.exiger_admin();
  select * into md from public.modeles_recurrents where id = p_modele for update;
  if not found then
    raise exception 'Modèle introuvable.' using hint = 'statut_invalide';
  end if;
  update public.modeles_recurrents
     set actif = p_actif,
         prochaine_publication = case when p_actif then public.prochaine_occurrence(frequence, jour_semaine, heure_publication, now())
                                      else prochaine_publication end
   where id = p_modele;
  perform public.journaliser_detail(case when p_actif then 'modele_active' else 'modele_desactive' end, null, null,
                                    null, jsonb_build_object('modele', p_modele));
end;
$$;

-- Crée les occurrences des 24 prochaines heures (en « programmé ») et avance les modèles
create function public.generer_recurrences()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  md      record;
  v_nb    integer := 0;
  v_quand timestamptz;
  v_id    bigint;
begin
  for md in select * from public.modeles_recurrents where actif and prochaine_publication <= now() + interval '24 hours' for update loop
    v_quand := md.prochaine_publication;
    -- Rattrapage : on ne crée pas de marchés dans le passé
    if v_quand <= now() then
      v_quand := public.prochaine_occurrence(md.frequence, md.jour_semaine, md.heure_publication, now());
    end if;
    while v_quand <= now() + interval '24 hours' loop
      insert into public.marches (question, categorie, source, date_fin, statut, date_publication, soki_programme, modele_id)
      values (replace(md.question_modele, '{date}', to_char(v_quand at time zone 'Africa/Kinshasa', 'DD/MM/YYYY')),
              md.categorie, md.source, v_quand + make_interval(hours => md.duree_heures), 'programme', v_quand, md.soki, md.id)
      returning id into v_id;
      insert into public.options_marche (marche_id, libelle, ordre) values (v_id, 'OUI', 0), (v_id, 'NON', 1);
      v_nb := v_nb + 1;
      v_quand := public.prochaine_occurrence(md.frequence, md.jour_semaine, md.heure_publication, v_quand);
    end loop;
    update public.modeles_recurrents set prochaine_publication = v_quand where id = md.id;
  end loop;
  return v_nb;
end;
$$;

-- Publie les marchés programmés arrivés à l'heure ; un marché « Soki » devient le Soki du jour
create function public.publier_marches_programmes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nb   integer;
  v_soki bigint;
begin
  with publies as (
    update public.marches set statut = 'approuve', examine_le = now()
     where statut = 'programme' and date_publication <= now() and date_fin > now()
    returning id, soki_programme, date_publication
  )
  select count(*), (select id from publies where soki_programme order by date_publication desc limit 1)
    into v_nb, v_soki from publies;

  if v_soki is not null then
    update public.marches set soki_du_jour = false where soki_du_jour and id <> v_soki;
    update public.marches set soki_du_jour = true where id = v_soki;
  end if;
  return v_nb;
end;
$$;

-- Toutes les minutes : récurrences puis publication (la fermeture tourne déjà toutes les 5 minutes)
select cron.schedule(
  'kongox-publier-marches',
  '* * * * *',
  $$select public.generer_recurrences(); select public.publier_marches_programmes();$$
);


-- ---------------------------------------------------------------------
-- 7. Pièces : ajustements par un admin et bonus en masse
-- ---------------------------------------------------------------------
alter table public.transactions_pieces drop constraint transactions_type_valide;
alter table public.transactions_pieces add constraint transactions_type_valide check (
  type in ('inscription', 'bonus_quotidien', 'bonus_serie', 'mise', 'gain', 'remboursement', 'question_approuvee', 'ajustement_admin')
);

create table public.ajustements_pieces (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  montant        bigint      not null,
  raison         text        not null,
  lot            uuid,                                    -- même valeur pour un bonus en masse
  auteur_id      uuid        references public.utilisateurs (id) on delete set null,
  solde_avant    bigint      not null,
  solde_apres    bigint      not null,
  cree_le        timestamptz not null default now(),
  constraint ajustements_montant_non_nul check (montant <> 0),
  constraint ajustements_raison_longueur check (char_length(raison) between 3 and 200)
);
create index ajustements_date on public.ajustements_pieces (cree_le desc);

-- Ajouter (montant > 0) ou retirer (montant < 0) des pièces à un compte
create function public.ajuster_pieces(p_utilisateur uuid, p_montant bigint, p_raison text, p_lot uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raison text := btrim(coalesce(p_raison, ''));
  v_avant  bigint;
  v_apres  bigint;
begin
  perform public.exiger_admin();
  if p_utilisateur = auth.uid() then
    raise exception 'Pas d''ajustement sur son propre compte.' using hint = 'soi_meme';
  end if;
  if p_montant is null or p_montant = 0 or abs(p_montant) > public.reglage('ajustement_max') then
    raise exception 'Montant invalide.' using hint = 'montant_ajustement_invalide', detail = public.reglage('ajustement_max')::text;
  end if;
  if char_length(v_raison) < 3 or char_length(v_raison) > 200 then
    raise exception 'Raison obligatoire.' using hint = 'raison_obligatoire';
  end if;

  select solde_pieces into v_avant from public.utilisateurs where id = p_utilisateur for update;
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if v_avant + p_montant < 0 then
    raise exception 'Le solde deviendrait négatif.' using hint = 'solde_negatif', detail = v_avant::text;
  end if;

  v_apres := public.mouvement_pieces(p_utilisateur, p_montant, 'ajustement_admin', 'Ajustement admin : ' || v_raison);
  insert into public.ajustements_pieces (utilisateur_id, montant, raison, lot, auteur_id, solde_avant, solde_apres)
  values (p_utilisateur, p_montant, v_raison, p_lot, auth.uid(), v_avant, v_apres);
  if p_lot is null then
    perform public.journaliser_detail('ajustement_pieces', p_utilisateur, null,
      jsonb_build_object('solde', v_avant), jsonb_build_object('solde', v_apres), jsonb_build_object('montant', p_montant, 'raison', v_raison));
  end if;
  return v_apres;
end;
$$;

-- Bonus en masse : p_cible = 'liste' (p_noms) ou 'actifs_7j' / 'actifs_30j'. Jamais à soi-même.
create function public.bonus_en_masse(p_cible text, p_noms text[], p_montant bigint, p_raison text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot  uuid := gen_random_uuid();
  v_ids  uuid[];
  v_id   uuid;
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
     where type in ('bonus_quotidien', 'mise') and cree_le >= now() - make_interval(days => v_jours)
       and utilisateur_id <> auth.uid();
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
    jsonb_build_object('lot', v_lot, 'cible', p_cible, 'comptes', cardinality(v_ids), 'montant', p_montant,
                       'total', p_montant * cardinality(v_ids), 'raison', btrim(p_raison)));
  return jsonb_build_object('comptes', cardinality(v_ids), 'total', p_montant * cardinality(v_ids), 'lot', v_lot);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Tableau de bord
-- ---------------------------------------------------------------------
-- Compte actif un jour = a reçu le bonus de connexion ou a misé ce jour-là
create function public.tableau_de_bord()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz := ((now() at time zone 'Africa/Kinshasa')::date)::timestamp at time zone 'Africa/Kinshasa';
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'inscrits',     (select count(*) from public.utilisateurs where cree_le >= v_debut),
    'actifs',       (select count(distinct utilisateur_id) from public.transactions_pieces
                      where type in ('bonus_quotidien', 'mise') and cree_le >= v_debut),
    'predictions',  (select count(*) from public.predictions where cree_le >= v_debut),
    'pieces_misees',(select coalesce(sum(montant), 0) from public.predictions where cree_le >= v_debut),
    'en_attente',   (select count(*) from public.marches where statut = 'en_attente'),
    'a_regler',     (select count(*) from public.marches where statut = 'ferme' or (statut = 'approuve' and date_fin <= now())),
    'utilisateurs', (select count(*) from public.utilisateurs),
    'en_ligne',     (select count(*) from public.marches where statut = 'approuve' and date_fin > now()),
    'programmes',   (select count(*) from public.marches where statut = 'programme')
  );
end;
$$;

-- Série par jour (heure de Kinshasa) : p_jours = 7, 30, ou null pour « tout »
create function public.series_tableau_de_bord(p_jours integer)
returns table (jour date, inscrits bigint, actifs bigint, predictions bigint, pieces_misees bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fin   date := (now() at time zone 'Africa/Kinshasa')::date;
  v_debut date;
begin
  perform public.exiger_admin();
  if p_jours is null then
    select coalesce(min((cree_le at time zone 'Africa/Kinshasa')::date), v_fin) into v_debut from public.utilisateurs;
  else
    v_debut := v_fin - (p_jours - 1);
  end if;

  return query
  with jours as (select generate_series(v_debut, v_fin, interval '1 day')::date as j)
  select j.j,
         (select count(*) from public.utilisateurs u where (u.cree_le at time zone 'Africa/Kinshasa')::date = j.j),
         (select count(distinct t.utilisateur_id) from public.transactions_pieces t
           where t.type in ('bonus_quotidien', 'mise') and (t.cree_le at time zone 'Africa/Kinshasa')::date = j.j),
         (select count(*) from public.predictions p where (p.cree_le at time zone 'Africa/Kinshasa')::date = j.j),
         (select coalesce(sum(p.montant), 0)::bigint from public.predictions p where (p.cree_le at time zone 'Africa/Kinshasa')::date = j.j)
    from jours j
   order by j.j;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.journaliser_detail(text, uuid, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.journaliser(text, uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.journal_modification_marche() from public, anon, authenticated;
revoke execute on function public.journal_modification_utilisateur() from public, anon, authenticated;
revoke execute on function public.generer_recurrences() from public, anon, authenticated;
revoke execute on function public.publier_marches_programmes() from public, anon, authenticated;
revoke execute on function public.prochaine_occurrence(text, smallint, time, timestamptz) from public, anon, authenticated;
revoke execute on function public.verifier_champs_marche(text, text, text) from public, anon, authenticated;
revoke execute on function public.exiger_admin() from public, anon, authenticated;
revoke execute on function public.limite_mise_quotidienne() from public, anon, authenticated;
revoke execute on function public.seuil_essai_curateur() from public, anon, authenticated;

revoke execute on function public.reglage(text) from public;
grant execute on function public.reglage(text) to anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.modifier_reglage(text, bigint, text)',
    'public.creer_marche_admin(text, text, text, timestamptz, text, timestamptz, boolean, boolean)',
    'public.modifier_marche_admin(bigint, text, text, text, timestamptz, timestamptz, boolean, boolean)',
    'public.changer_etat_marche(bigint, text)',
    'public.mettre_en_avant(bigint, boolean)',
    'public.dupliquer_marche(bigint)',
    'public.supprimer_marche(bigint, text)',
    'public.mises_en_cours(bigint)',
    'public.creer_modele_recurrent(text, text, text, text, smallint, time, integer, boolean)',
    'public.activer_modele(bigint, boolean)',
    'public.ajuster_pieces(uuid, bigint, text, uuid)',
    'public.bonus_en_masse(text, text[], bigint, text)',
    'public.tableau_de_bord()',
    'public.series_tableau_de_bord(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------
-- Les curateurs ne voient que les questions EN ATTENTE de leurs thèmes
-- (pas les brouillons ni les marchés programmés de l'admin)
drop policy "Marchés publiés visibles" on public.marches;
create policy "Marchés publiés visibles"
  on public.marches for select to anon, authenticated
  using (
    statut in ('approuve', 'ferme', 'regle')
    or (auteur_id = (select auth.uid()) and statut in ('en_attente', 'refuse', 'supprime'))
    or (select public.est_admin())
    or (statut = 'en_attente' and public.statut_curateur(categorie) is not null)
  );

-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
alter table public.reglages           enable row level security;
alter table public.modeles_recurrents enable row level security;
alter table public.ajustements_pieces enable row level security;

revoke all on table public.reglages           from anon, authenticated;
revoke all on table public.modeles_recurrents from anon, authenticated;
revoke all on table public.ajustements_pieces from anon, authenticated;

-- Les réglages sont des règles publiques du jeu (affichées dans l'application)
grant select on table public.reglages to anon, authenticated;
create policy "Réglages publics" on public.reglages for select to anon, authenticated using (true);

grant select on table public.modeles_recurrents to authenticated;
create policy "Modèles réservés aux admins" on public.modeles_recurrents for select to authenticated
  using ((select public.est_admin()));

grant select on table public.ajustements_pieces to authenticated;
create policy "Ajustements réservés aux admins" on public.ajustements_pieces for select to authenticated
  using ((select public.est_admin()));
