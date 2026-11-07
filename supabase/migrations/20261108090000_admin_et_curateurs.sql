-- =====================================================================
-- KongoX — Étape 3 : panneau admin, curateurs, cadeaux, journal admin
-- =====================================================================
-- Rôles : utilisateur, curateur, admin (colonne utilisateurs.role, étape 1).
-- Curateurs : candidature → période d'essai (leurs décisions sont validées
-- par un admin) → autonomes dans leur thème après 10 décisions validées.
-- Les admins gardent le dernier mot (ils peuvent annuler un marché approuvé).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- Journal des actions des admins et curateurs (qui a fait quoi, quand)
create table public.journal_admin (
  id                bigint generated always as identity primary key,
  auteur_id         uuid        references public.utilisateurs (id) on delete set null,
  action            text        not null,
  cible_utilisateur uuid        references public.utilisateurs (id) on delete set null,
  cible_marche      bigint      references public.marches (id) on delete set null,
  details           jsonb,
  cree_le           timestamptz not null default now()
);
create index journal_admin_date on public.journal_admin (cree_le desc);

-- Curateurs : un utilisateur peut l'être dans un ou plusieurs thèmes
create table public.curateurs (
  utilisateur_id        uuid        not null references public.utilisateurs (id) on delete cascade,
  categorie             text        not null,
  statut                text        not null default 'essai',
  decisions_validees    integer     not null default 0,
  nomme_par             uuid        references public.utilisateurs (id) on delete set null,
  cree_le               timestamptz not null default now(),
  primary key (utilisateur_id, categorie),
  constraint curateurs_categorie_valide check (categorie in ('football', 'musique', 'politique', 'vie_quotidienne')),
  constraint curateurs_statut_valide check (statut in ('essai', 'autonome'))
);

-- Candidatures pour devenir curateur
create table public.candidatures_curateur (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  categorie      text        not null,
  motivation     text        not null,
  statut         text        not null default 'en_attente',
  motif          text,
  examine_par    uuid        references public.utilisateurs (id) on delete set null,
  examine_le     timestamptz,
  cree_le        timestamptz not null default now(),
  constraint candidatures_categorie_valide check (categorie in ('football', 'musique', 'politique', 'vie_quotidienne')),
  constraint candidatures_motivation_longueur check (char_length(motivation) between 20 and 1000),
  constraint candidatures_statut_valide check (statut in ('en_attente', 'acceptee', 'refusee'))
);
create unique index candidatures_une_en_attente on public.candidatures_curateur (utilisateur_id, categorie) where statut = 'en_attente';

-- Décisions des curateurs en période d'essai, à valider par un admin
create table public.decisions_curateur (
  id          bigint generated always as identity primary key,
  marche_id   bigint      not null references public.marches (id) on delete restrict,
  curateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  decision    text        not null,
  motif       text,
  statut      text        not null default 'a_valider',
  valide_par  uuid        references public.utilisateurs (id) on delete set null,
  valide_le   timestamptz,
  cree_le     timestamptz not null default now(),
  constraint decisions_decision_valide check (decision in ('approuve', 'refuse')),
  constraint decisions_statut_valide check (statut in ('a_valider', 'validee', 'annulee'))
);
create unique index decisions_une_par_marche on public.decisions_curateur (marche_id) where statut = 'a_valider';

-- Cadeaux (crédit, forfait internet…) envoyés à la main par l'équipe
create table public.cadeaux (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  type           text        not null,
  description    text,
  statut         text        not null default 'a_envoyer',
  telephone      text,                                   -- numéro utilisé au moment de l'envoi
  cree_par       uuid        references public.utilisateurs (id) on delete set null,
  envoye_par     uuid        references public.utilisateurs (id) on delete set null,
  envoye_le      timestamptz,
  cree_le        timestamptz not null default now(),
  constraint cadeaux_type_valide check (type in ('credit', 'forfait_internet', 'produit')),
  constraint cadeaux_statut_valide check (statut in ('a_envoyer', 'envoye', 'annule')),
  constraint cadeaux_description_longueur check (description is null or char_length(description) <= 200)
);
create index cadeaux_statut on public.cadeaux (statut, cree_le);


-- ---------------------------------------------------------------------
-- 2. Outils
-- ---------------------------------------------------------------------

-- Nombre de décisions validées pour sortir de la période d'essai
create function public.seuil_essai_curateur()
returns integer language sql immutable as $$ select 10 $$;

-- Statut de curateur de l'utilisateur connecté pour une catégorie (null si non curateur)
create function public.statut_curateur(p_categorie text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select statut from public.curateurs where utilisateur_id = auth.uid() and categorie = p_categorie;
$$;

-- L'utilisateur connecté est-il curateur (dans au moins un thème) ?
create function public.est_curateur()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.curateurs where utilisateur_id = auth.uid());
$$;

-- Écrit une ligne dans le journal (interne)
create function public.journaliser(p_action text, p_utilisateur uuid default null, p_marche bigint default null, p_details jsonb default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.journal_admin (auteur_id, action, cible_utilisateur, cible_marche, details)
  values (auth.uid(), p_action, p_utilisateur, p_marche, p_details);
$$;

-- Version appelable par l'application (actions faites avec la clé service role : mot de passe, suspension)
create function public.journaliser_action_admin(p_action text, p_utilisateur uuid, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  perform public.journaliser(p_action, p_utilisateur, null, p_details);
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Approbation et refus (admin, curateur autonome, curateur en essai)
-- ---------------------------------------------------------------------
-- Les fonctions de l'étape 2 sont remplacées : elles renvoient maintenant
-- 'approuve' / 'refuse' (décision appliquée) ou 'en_validation' (curateur en essai).

drop function public.approuver_marche(bigint);
drop function public.refuser_marche(bigint, text);

-- Applique l'approbation (interne) : statut, +50 pièces et badge pour l'auteur
create function public.appliquer_approbation(p_marche bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche public.marches%rowtype;
begin
  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut <> 'en_attente' then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;

  update public.marches set statut = 'approuve', examine_par = auth.uid(), examine_le = now() where id = p_marche;

  if v_marche.auteur_id is not null then
    perform public.mouvement_pieces(v_marche.auteur_id, 50, 'question_approuvee',
                                    'Question approuvée : ' || v_marche.question, p_marche);
    update public.utilisateurs
       set badges = array_append(badges, 'Créateur de marché')
     where id = v_marche.auteur_id and not ('Créateur de marché' = any (badges));
  end if;
end;
$$;

-- Applique le refus (interne)
create function public.appliquer_refus(p_marche bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.marches
     set statut = 'refuse', motif = nullif(btrim(p_motif), ''), examine_par = auth.uid(), examine_le = now()
   where id = p_marche and statut = 'en_attente';
  if not found then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;
end;
$$;

-- Clôt la décision d'essai en attente sur ce marché après une action d'admin (interne).
-- Même décision que l'admin → validée (compte pour la sortie d'essai) ; sinon → annulée.
create function public.clore_decision_curateur(p_marche bigint, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  select * into d from public.decisions_curateur where marche_id = p_marche and statut = 'a_valider' for update;
  if not found then
    return;
  end if;

  update public.decisions_curateur
     set statut = case when d.decision = p_decision then 'validee' else 'annulee' end,
         valide_par = auth.uid(), valide_le = now()
   where id = d.id;

  if d.decision = p_decision then
    update public.curateurs c
       set decisions_validees = c.decisions_validees + 1,
           statut = case when c.decisions_validees + 1 >= public.seuil_essai_curateur() then 'autonome' else c.statut end
      from public.marches m
     where m.id = p_marche and c.utilisateur_id = d.curateur_id and c.categorie = m.categorie;
  end if;
end;
$$;

-- Qui peut décider pour ce marché ? 'admin', 'autonome', 'essai' (ou erreur)
create function public.droit_decision(p_marche bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_categorie text;
  v_statut    text;
begin
  if public.est_admin() then
    return 'admin';
  end if;
  select categorie into v_categorie from public.marches where id = p_marche;
  v_statut := public.statut_curateur(v_categorie);
  if v_statut is null then
    raise exception 'Réservé aux admins et aux curateurs de ce thème.' using hint = 'reserve_admin';
  end if;
  return v_statut;
end;
$$;

create function public.approuver_marche(p_marche bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_droit text := public.droit_decision(p_marche);
begin
  if v_droit = 'essai' then
    if exists (select 1 from public.decisions_curateur where marche_id = p_marche and statut = 'a_valider') then
      raise exception 'Une décision attend déjà la validation d''un admin.' using hint = 'decision_en_attente';
    end if;
    if not exists (select 1 from public.marches where id = p_marche and statut = 'en_attente') then
      raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
    end if;
    insert into public.decisions_curateur (marche_id, curateur_id, decision) values (p_marche, auth.uid(), 'approuve');
    perform public.journaliser('decision_curateur_approuve', null, p_marche);
    return 'en_validation';
  end if;

  perform public.appliquer_approbation(p_marche);
  if v_droit = 'admin' then
    perform public.clore_decision_curateur(p_marche, 'approuve');
  end if;
  perform public.journaliser('marche_approuve', null, p_marche);
  return 'approuve';
end;
$$;

create function public.refuser_marche(p_marche bigint, p_motif text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_droit text := public.droit_decision(p_marche);
begin
  if v_droit = 'essai' then
    if exists (select 1 from public.decisions_curateur where marche_id = p_marche and statut = 'a_valider') then
      raise exception 'Une décision attend déjà la validation d''un admin.' using hint = 'decision_en_attente';
    end if;
    if not exists (select 1 from public.marches where id = p_marche and statut = 'en_attente') then
      raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
    end if;
    insert into public.decisions_curateur (marche_id, curateur_id, decision, motif)
    values (p_marche, auth.uid(), 'refuse', nullif(btrim(p_motif), ''));
    perform public.journaliser('decision_curateur_refuse', null, p_marche, jsonb_build_object('motif', p_motif));
    return 'en_validation';
  end if;

  perform public.appliquer_refus(p_marche, p_motif);
  if v_droit = 'admin' then
    perform public.clore_decision_curateur(p_marche, 'refuse');
  end if;
  perform public.journaliser('marche_refuse', null, p_marche, jsonb_build_object('motif', p_motif));
  return 'refuse';
end;
$$;

-- Un admin valide ou rejette la décision d'un curateur en essai
create function public.valider_decision_curateur(p_decision bigint, p_accepter boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select * into d from public.decisions_curateur where id = p_decision and statut = 'a_valider';
  if not found then
    raise exception 'Décision introuvable ou déjà traitée.' using hint = 'statut_invalide';
  end if;

  if p_accepter then
    if d.decision = 'approuve' then
      perform public.appliquer_approbation(d.marche_id);
    else
      perform public.appliquer_refus(d.marche_id, d.motif);
    end if;
    perform public.clore_decision_curateur(d.marche_id, d.decision);
  else
    update public.decisions_curateur set statut = 'annulee', valide_par = auth.uid(), valide_le = now() where id = d.id;
  end if;
  perform public.journaliser(case when p_accepter then 'decision_validee' else 'decision_rejetee' end, d.curateur_id, d.marche_id);
end;
$$;

-- Modifier le texte d'une question en attente (admin ou curateur du thème)
create function public.modifier_marche(p_marche bigint, p_question text, p_categorie text, p_date_fin timestamptz, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question text := btrim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  v_source   text := btrim(coalesce(p_source, ''));
begin
  perform public.droit_decision(p_marche);
  -- Un curateur ne peut pas déplacer une question vers un thème qui n'est pas le sien
  if not public.est_admin() and public.statut_curateur(p_categorie) is null then
    raise exception 'Réservé aux admins et aux curateurs de ce thème.' using hint = 'reserve_admin';
  end if;
  if char_length(v_question) < 15 or char_length(v_question) > 200 or right(v_question, 1) <> '?' then
    raise exception 'Question invalide.' using hint = 'question_invalide';
  end if;
  if p_categorie not in ('football', 'musique', 'politique', 'vie_quotidienne') then
    raise exception 'Catégorie invalide.' using hint = 'categorie_invalide';
  end if;
  if p_date_fin is null or p_date_fin < now() + interval '1 hour' or p_date_fin > now() + interval '2 years' then
    raise exception 'Date de fin invalide.' using hint = 'date_invalide';
  end if;
  if char_length(v_source) < 3 or char_length(v_source) > 200 then
    raise exception 'Source invalide.' using hint = 'source_invalide';
  end if;

  update public.marches
     set question = v_question, categorie = p_categorie, date_fin = p_date_fin, source = v_source
   where id = p_marche and statut = 'en_attente';
  if not found then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser('marche_modifie', null, p_marche);
end;
$$;

-- Mettre une question en « Soki du jour » (une seule à la fois)
create function public.definir_soki_du_jour(p_marche bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  if not exists (select 1 from public.marches where id = p_marche and statut = 'approuve' and date_fin > now()) then
    raise exception 'Seul un marché ouvert peut être le Soki du jour.' using hint = 'statut_invalide';
  end if;
  update public.marches set soki_du_jour = false where soki_du_jour and id <> p_marche;
  update public.marches set soki_du_jour = true where id = p_marche;
  perform public.journaliser('soki_du_jour', null, p_marche);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Curateurs : candidature, acceptation, statut
-- ---------------------------------------------------------------------
create function public.postuler_curateur(p_categorie text, p_motivation text)
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

-- Libellé de badge « Curateur Football », « Curateur Vie quotidienne »…
create function public.badge_curateur(p_categorie text)
returns text language sql immutable as $$
  select 'Curateur ' || case p_categorie
    when 'football' then 'Football' when 'musique' then 'Musique'
    when 'politique' then 'Politique' else 'Vie quotidienne' end;
$$;

create function public.traiter_candidature(p_candidature bigint, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select * into c from public.candidatures_curateur where id = p_candidature and statut = 'en_attente' for update;
  if not found then
    raise exception 'Candidature introuvable ou déjà traitée.' using hint = 'statut_invalide';
  end if;

  update public.candidatures_curateur
     set statut = case when p_accepter then 'acceptee' else 'refusee' end,
         motif = nullif(btrim(p_motif), ''), examine_par = auth.uid(), examine_le = now()
   where id = c.id;

  if p_accepter then
    insert into public.curateurs (utilisateur_id, categorie, nomme_par)
    values (c.utilisateur_id, c.categorie, auth.uid())
    on conflict do nothing;
    update public.utilisateurs
       set role = case when role = 'utilisateur' then 'curateur' else role end,
           badges = case when public.badge_curateur(c.categorie) = any (badges) then badges
                         else array_append(badges, public.badge_curateur(c.categorie)) end
     where id = c.utilisateur_id;
  end if;
  perform public.journaliser(case when p_accepter then 'candidature_acceptee' else 'candidature_refusee' end,
                             c.utilisateur_id, null, jsonb_build_object('categorie', c.categorie));
end;
$$;

-- Changer le statut d'un curateur : 'essai', 'autonome' ou 'retirer'
create function public.changer_statut_curateur(p_utilisateur uuid, p_categorie text, p_statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  if p_statut = 'retirer' then
    delete from public.curateurs where utilisateur_id = p_utilisateur and categorie = p_categorie;
    update public.utilisateurs
       set badges = array_remove(badges, public.badge_curateur(p_categorie)),
           role = case when role = 'curateur' and not exists (select 1 from public.curateurs where utilisateur_id = p_utilisateur)
                       then 'utilisateur' else role end
     where id = p_utilisateur;
  elsif p_statut in ('essai', 'autonome') then
    update public.curateurs set statut = p_statut where utilisateur_id = p_utilisateur and categorie = p_categorie;
    if not found then
      raise exception 'Curateur introuvable.' using hint = 'statut_invalide';
    end if;
  else
    raise exception 'Statut invalide.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser('curateur_' || p_statut, p_utilisateur, null, jsonb_build_object('categorie', p_categorie));
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Utilisateurs : rôle
-- ---------------------------------------------------------------------
create function public.changer_role(p_utilisateur uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  if p_role not in ('utilisateur', 'curateur', 'admin') then
    raise exception 'Rôle invalide.' using hint = 'statut_invalide';
  end if;
  -- Un admin ne peut pas se retirer lui-même ses droits (évite de bloquer le panneau)
  if p_utilisateur = auth.uid() and p_role <> 'admin' then
    raise exception 'Tu ne peux pas retirer ton propre rôle d''admin.' using hint = 'soi_meme';
  end if;
  update public.utilisateurs set role = p_role where id = p_utilisateur;
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  perform public.journaliser('role_' || p_role, p_utilisateur);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Cadeaux (envoi manuel)
-- ---------------------------------------------------------------------
create function public.creer_cadeau(p_nom_utilisateur text, p_type text, p_description text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utilisateur uuid;
  v_cadeau      bigint;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select id into v_utilisateur from public.utilisateurs where lower(nom_utilisateur) = lower(btrim(p_nom_utilisateur));
  if not found then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  if p_type not in ('credit', 'forfait_internet', 'produit') then
    raise exception 'Type de cadeau invalide.' using hint = 'statut_invalide';
  end if;
  insert into public.cadeaux (utilisateur_id, type, description, cree_par)
  values (v_utilisateur, p_type, nullif(btrim(p_description), ''), auth.uid())
  returning id into v_cadeau;
  perform public.journaliser('cadeau_cree', v_utilisateur, null, jsonb_build_object('cadeau', v_cadeau, 'type', p_type));
  return v_cadeau;
end;
$$;

-- Marquer comme envoyé : le numéro du gagnant est obligatoire et gardé avec le cadeau
create function public.marquer_cadeau_envoye(p_cadeau bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c     record;
  v_tel text;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  select * into c from public.cadeaux where id = p_cadeau and statut = 'a_envoyer' for update;
  if not found then
    raise exception 'Cadeau introuvable ou déjà traité.' using hint = 'statut_invalide';
  end if;
  select telephone into v_tel from public.coordonnees_utilisateurs where utilisateur_id = c.utilisateur_id;
  if v_tel is null then
    raise exception 'Numéro manquant.' using hint = 'numero_manquant';
  end if;
  update public.cadeaux set statut = 'envoye', telephone = v_tel, envoye_par = auth.uid(), envoye_le = now() where id = c.id;
  perform public.journaliser('cadeau_envoye', c.utilisateur_id, null, jsonb_build_object('cadeau', c.id));
end;
$$;

create function public.annuler_cadeau(p_cadeau bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utilisateur uuid;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  update public.cadeaux set statut = 'annule' where id = p_cadeau and statut = 'a_envoyer'
  returning utilisateur_id into v_utilisateur;
  if not found then
    raise exception 'Cadeau introuvable ou déjà traité.' using hint = 'statut_invalide';
  end if;
  perform public.journaliser('cadeau_annule', v_utilisateur, null, jsonb_build_object('cadeau', p_cadeau));
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Chiffres du tableau de bord
-- ---------------------------------------------------------------------
create function public.statistiques_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
  return jsonb_build_object(
    'en_attente',      (select count(*) from public.marches where statut = 'en_attente'),
    'au_dela_12h',     (select count(*) from public.marches where statut = 'en_attente' and cree_le < now() - interval '12 hours'),
    'delai_moyen_h',   (select round(extract(epoch from avg(examine_le - cree_le)) / 3600)
                          from public.marches where examine_le > now() - interval '30 days'),
    'a_regler',        (select count(*) from public.marches where statut = 'ferme' or (statut = 'approuve' and date_fin <= now())),
    'cadeaux',         (select count(*) from public.cadeaux where statut = 'a_envoyer'),
    'candidatures',    (select count(*) from public.candidatures_curateur where statut = 'en_attente'),
    'decisions',       (select count(*) from public.decisions_curateur where statut = 'a_valider')
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Journal du règlement et de l'annulation (fonctions de l'étape 2)
-- ---------------------------------------------------------------------
-- Pour garder ces fonctions intactes, le journal est écrit par un déclencheur.
create function public.journaliser_reglement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'regle' and old.statut <> 'regle' then
    perform public.journaliser(case when new.option_gagnante_id is null then 'marche_annule' else 'marche_regle' end,
                               null, new.id,
                               jsonb_build_object('option_gagnante', new.option_gagnante_id, 'lien', new.lien_resultat, 'motif', new.motif));
  end if;
  return new;
end;
$$;

create trigger marches_journal_reglement
  after update of statut on public.marches
  for each row execute function public.journaliser_reglement();


-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.seuil_essai_curateur() from public, anon, authenticated;
revoke execute on function public.journaliser(text, uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.appliquer_approbation(bigint) from public, anon, authenticated;
revoke execute on function public.appliquer_refus(bigint, text) from public, anon, authenticated;
revoke execute on function public.clore_decision_curateur(bigint, text) from public, anon, authenticated;
revoke execute on function public.droit_decision(bigint) from public, anon, authenticated;
revoke execute on function public.journaliser_reglement() from public, anon, authenticated;
revoke execute on function public.badge_curateur(text) from public, anon, authenticated;

revoke execute on function public.statut_curateur(text) from public;
revoke execute on function public.est_curateur() from public;
grant execute on function public.statut_curateur(text) to anon, authenticated;   -- utilisée par la RLS
grant execute on function public.est_curateur() to anon, authenticated;

-- Fonctions appelables par un utilisateur connecté (chacune vérifie elle-même les droits)
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.journaliser_action_admin(text, uuid, jsonb)',
    'public.approuver_marche(bigint)',
    'public.refuser_marche(bigint, text)',
    'public.valider_decision_curateur(bigint, boolean)',
    'public.modifier_marche(bigint, text, text, timestamptz, text)',
    'public.definir_soki_du_jour(bigint)',
    'public.postuler_curateur(text, text)',
    'public.traiter_candidature(bigint, boolean, text)',
    'public.changer_statut_curateur(uuid, text, text)',
    'public.changer_role(uuid, text)',
    'public.creer_cadeau(text, text, text)',
    'public.marquer_cadeau_envoye(bigint)',
    'public.annuler_cadeau(bigint)',
    'public.statistiques_admin()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------
alter table public.journal_admin         enable row level security;
alter table public.curateurs             enable row level security;
alter table public.candidatures_curateur enable row level security;
alter table public.decisions_curateur    enable row level security;
alter table public.cadeaux               enable row level security;

revoke all on table public.journal_admin         from anon, authenticated;
revoke all on table public.curateurs             from anon, authenticated;
revoke all on table public.candidatures_curateur from anon, authenticated;
revoke all on table public.decisions_curateur    from anon, authenticated;
revoke all on table public.cadeaux               from anon, authenticated;

grant select on table public.journal_admin         to authenticated;
grant select on table public.curateurs             to anon, authenticated;
grant select on table public.candidatures_curateur to authenticated;
grant select on table public.decisions_curateur    to authenticated;
grant select on table public.cadeaux               to authenticated;

create policy "Journal réservé aux admins"
  on public.journal_admin for select to authenticated
  using ((select public.est_admin()));

create policy "Curateurs publics"
  on public.curateurs for select to anon, authenticated
  using (true);

create policy "Mes candidatures, ou toutes pour les admins"
  on public.candidatures_curateur for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

create policy "Mes décisions, ou toutes pour les admins"
  on public.decisions_curateur for select to authenticated
  using (curateur_id = (select auth.uid()) or (select public.est_admin()));

create policy "Mes cadeaux, ou tous pour les admins"
  on public.cadeaux for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

-- Les admins lisent les coordonnées (numéro pour les cadeaux), les transactions et les prédictions
create policy "Les admins lisent les coordonnées"
  on public.coordonnees_utilisateurs for select to authenticated
  using ((select public.est_admin()));

create policy "Les admins lisent les transactions"
  on public.transactions_pieces for select to authenticated
  using ((select public.est_admin()));

create policy "Les admins lisent les prédictions"
  on public.predictions for select to authenticated
  using ((select public.est_admin()));

-- Les curateurs voient les questions en attente de leurs thèmes
drop policy "Marchés publiés visibles" on public.marches;
create policy "Marchés publiés visibles"
  on public.marches for select to anon, authenticated
  using (
    statut in ('approuve', 'ferme', 'regle')
    or auteur_id = (select auth.uid())
    or (select public.est_admin())
    or public.statut_curateur(categorie) is not null
  );
