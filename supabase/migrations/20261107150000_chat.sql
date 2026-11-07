-- =====================================================================
-- KongoX — Étape 5 (troisième partie) : chat, commentaires, signalements
-- =====================================================================
-- Un salon par marché (sous le marché : « Commentaires »), donc aussi un par
-- match (chaque match a son marché 1 N 2), et un par communauté.
-- Messages en direct avec Supabase Realtime. Écriture seulement par
-- envoyer_message() : connexion, limites de vitesse, filtre de mots, liens retirés.
-- Signalements des messages et des marchés, masquage automatique après
-- plusieurs signalements, modération dans Admin › Signalements.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------
insert into public.reglages (cle, libelle, valeur, minimum, maximum) values
  ('chat_longueur_max',          'Chat : longueur maximale d''un message (caractères)',             500, 50, 2000),
  ('chat_intervalle_secondes',   'Chat : secondes minimum entre deux messages d''une personne',       5,  0, 600),
  ('chat_messages_10min',        'Chat : messages maximum par personne en 10 minutes',                20,  1, 500),
  ('chat_signalements_masquage', 'Chat : signalements de personnes différentes pour masquer un message', 3, 1, 100);

-- Blocage du chat pour une personne (modération), jusqu'à une date. Lisible par les admins seulement.
create table public.blocages_chat (
  utilisateur_id uuid        primary key references public.utilisateurs (id) on delete cascade,
  jusqu          timestamptz not null,
  bloque_par     uuid        references public.utilisateurs (id) on delete set null,
  bloque_le      timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. Messages
-- ---------------------------------------------------------------------
create table public.messages_chat (
  id            bigint generated always as identity primary key,
  marche_id     bigint      references public.marches (id) on delete restrict,
  communaute_id bigint      references public.communautes (id) on delete cascade,
  auteur_id     uuid        not null references public.utilisateurs (id) on delete cascade,
  auteur_nom    text        not null,             -- copié à l'envoi (affichage en direct sans requête)
  choix         text,                             -- OUI, NON, 1, N, 2 : l'option où l'auteur a le plus misé
  texte         text,                             -- null quand le message est masqué
  masque        boolean     not null default false,
  cree_le       timestamptz not null default now(),
  constraint messages_une_cible check ((marche_id is null) <> (communaute_id is null)),
  constraint messages_texte_present check (masque or texte is not null)
);
create index messages_chat_marche on public.messages_chat (marche_id, id desc) where marche_id is not null;
create index messages_chat_communaute on public.messages_chat (communaute_id, id desc) where communaute_id is not null;
create index messages_chat_auteur on public.messages_chat (auteur_id, cree_le desc);

-- Texte d'origine d'un message masqué (lisible par les admins seulement)
create table public.messages_masques (
  message_id bigint primary key references public.messages_chat (id) on delete cascade,
  texte      text        not null,
  motif      text        not null,
  masque_par uuid        references public.utilisateurs (id) on delete set null,   -- null = masquage automatique
  masque_le  timestamptz not null default now()
);

-- Mots interdits (comparés sans accents ni majuscules, mot entier)
create table public.mots_interdits (
  id       bigint generated always as identity primary key,
  mot      text        not null unique,
  cree_par uuid        references public.utilisateurs (id) on delete set null,
  cree_le  timestamptz not null default now(),
  constraint mots_interdits_format check (mot ~ '^[a-z0-9'' -]{2,40}$')
);
-- Liste de départ (français). Jonathan complètera en lingala et en swahili dans Admin › Signalements.
insert into public.mots_interdits (mot) values
  ('connard'), ('connasse'), ('salope'), ('pute'), ('encule'), ('batard'), ('fdp'), ('ntm'), ('nique ta mere');

-- Remplace les mots interdits par des étoiles et retire les liens.
-- sans_accents() et lower() gardent la longueur : les positions trouvées dans le texte simplifié
-- sont les mêmes que dans le texte d'origine.
create function public.filtrer_texte(p_texte text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texte text := p_texte;
  v_norme text;
  v_mot   text;
  v_motif text;
  v_pos   integer;
  v_long  integer;
begin
  -- Liens et adresses web (anti-arnaque)
  v_texte := regexp_replace(v_texte, '(https?://|www\.)\S+', '[lien retiré]', 'gi');
  v_texte := regexp_replace(v_texte, '\m[a-z0-9-]+\.(com|net|org|info|xyz|top|bet|cd|io|link|click)(/\S*)?\M', '[lien retiré]', 'gi');

  v_norme := public.sans_accents(lower(v_texte));
  if char_length(v_norme) <> char_length(v_texte) then
    v_norme := public.sans_accents(v_texte);   -- sécurité : lower() n'a pas gardé la longueur
  end if;
  for v_mot in select mot from public.mots_interdits loop
    v_motif := '\m' || regexp_replace(v_mot, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M';
    loop
      v_pos := regexp_instr(v_norme, v_motif, 1, 1, 0, 'i');
      exit when v_pos = 0;
      v_long := char_length(v_mot);
      v_texte := overlay(v_texte placing repeat('*', v_long) from v_pos for v_long);
      v_norme := overlay(v_norme placing repeat('*', v_long) from v_pos for v_long);
    end loop;
  end loop;
  return v_texte;
end;
$$;

-- Envoie un message dans le salon d'un marché (ou d'un match) ou d'une communauté
create function public.envoyer_message(p_marche bigint, p_communaute bigint, p_texte text)
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

  insert into public.messages_chat (marche_id, communaute_id, auteur_id, auteur_nom, choix, texte)
  values (p_marche, p_communaute, v_id, v_u.nom_utilisateur, v_choix, public.filtrer_texte(v_texte))
  returning * into v_msg;
  return v_msg;
end;
$$;

-- Commentaires d'un marché (remplace la version provisoire du fil) : messages non masqués
create or replace function public.commentaires_marche(p_marche bigint, p_depuis timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.messages_chat where marche_id = p_marche and not masque and cree_le >= p_depuis;
$$;


-- ---------------------------------------------------------------------
-- 3. Signalements
-- ---------------------------------------------------------------------
create table public.signalements (
  id         bigint generated always as identity primary key,
  message_id bigint      references public.messages_chat (id) on delete cascade,
  marche_id  bigint      references public.marches (id) on delete cascade,
  auteur_id  uuid        not null references public.utilisateurs (id) on delete cascade,
  motif      text        not null,
  detail     text,
  statut     text        not null default 'ouvert',
  traite_par uuid        references public.utilisateurs (id) on delete set null,
  traite_le  timestamptz,
  cree_le    timestamptz not null default now(),
  constraint signalements_une_cible check ((message_id is null) <> (marche_id is null)),
  constraint signalements_motif_valide check (motif in ('insulte', 'arnaque', 'spam', 'ligne_rouge', 'autre')),
  constraint signalements_statut_valide check (statut in ('ouvert', 'traite', 'rejete')),
  constraint signalements_detail_longueur check (detail is null or char_length(detail) <= 300)
);
create unique index signalements_un_par_message on public.signalements (message_id, auteur_id) where message_id is not null;
create unique index signalements_un_par_marche on public.signalements (marche_id, auteur_id) where marche_id is not null;
create index signalements_ouverts on public.signalements (statut, cree_le desc);

-- Masque un message : le texte part dans messages_masques (admins seulement)
create function public.masquer_message_interne(p_message bigint, p_motif text, p_par uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texte text;
begin
  select texte into v_texte from public.messages_chat where id = p_message and not masque for update;
  if not found then
    return false;
  end if;
  insert into public.messages_masques (message_id, texte, motif, masque_par) values (p_message, v_texte, p_motif, p_par)
  on conflict (message_id) do update set texte = excluded.texte, motif = excluded.motif, masque_par = excluded.masque_par, masque_le = now();
  update public.messages_chat set masque = true, texte = null where id = p_message;
  return true;
end;
$$;

-- Signaler un message (p_message) ou un marché (p_marche)
create function public.signaler(p_message bigint, p_marche bigint, p_motif text, p_detail text default null)
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
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if (p_message is null) = (p_marche is null) or p_motif not in ('insulte', 'arnaque', 'spam', 'ligne_rouge', 'autre') then
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
  elsif not exists (select 1 from public.marches where id = p_marche and statut in ('approuve', 'ferme', 'regle')) then
    raise exception 'Marché introuvable.' using hint = 'signalement_invalide';
  end if;
  -- 20 signalements par personne et par jour au maximum (anti-abus)
  if (select count(*) from public.signalements where auteur_id = v_id and cree_le > now() - interval '24 hours') >= 20 then
    raise exception 'Trop de signalements.' using hint = 'signalement_limite';
  end if;

  insert into public.signalements (message_id, marche_id, auteur_id, motif, detail)
  values (p_message, p_marche, v_id, p_motif, nullif(left(btrim(coalesce(p_detail, '')), 300), ''))
  on conflict do nothing;
  if not found then
    return 'deja';
  end if;

  -- Masquage automatique après N signalements de personnes différentes
  if p_message is not null then
    select count(*) into v_nb from public.signalements where message_id = p_message and statut <> 'rejete';
    if v_nb >= public.reglage('chat_signalements_masquage') and public.masquer_message_interne(p_message, 'signalements', null) then
      return 'masque';
    end if;
  end if;
  return 'enregistre';
end;
$$;

-- Admin : masquer un message (et clore ses signalements)
create function public.masquer_message(p_message bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant text;
begin
  perform public.exiger_admin();
  select texte into v_avant from public.messages_chat where id = p_message;
  if not found then
    raise exception 'Message introuvable.' using hint = 'statut_invalide';
  end if;
  perform public.masquer_message_interne(p_message, coalesce(nullif(btrim(p_motif), ''), 'moderation'), auth.uid());
  update public.signalements set statut = 'traite', traite_par = auth.uid(), traite_le = now() where message_id = p_message and statut = 'ouvert';
  perform public.journaliser_detail('message_masque', (select auteur_id from public.messages_chat where id = p_message), null,
    jsonb_build_object('message', p_message, 'texte', v_avant), jsonb_build_object('motif', p_motif));
end;
$$;

-- Admin : rétablir un message masqué (signalements rejetés)
create function public.retablir_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texte text;
begin
  perform public.exiger_admin();
  select texte into v_texte from public.messages_masques where message_id = p_message;
  if not found then
    raise exception 'Message non masqué.' using hint = 'statut_invalide';
  end if;
  update public.messages_chat set masque = false, texte = v_texte where id = p_message;
  delete from public.messages_masques where message_id = p_message;
  update public.signalements set statut = 'rejete', traite_par = auth.uid(), traite_le = now() where message_id = p_message and statut <> 'rejete';
  perform public.journaliser_detail('message_retabli', (select auteur_id from public.messages_chat where id = p_message), null, null, jsonb_build_object('message', p_message));
end;
$$;

-- Admin : clore un signalement sans masquer (rejete) ou après action (traite)
create function public.traiter_signalement(p_signalement bigint, p_statut text)
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
   where statut = 'ouvert' and (message_id = s.message_id or marche_id = s.marche_id);
  perform public.journaliser_detail('signalement_' || p_statut, null, s.marche_id, null,
    jsonb_build_object('signalement', p_signalement, 'message', s.message_id));
end;
$$;

-- Admin : bloquer une personne du chat pendant p_heures (0 = débloquer)
create function public.bloquer_chat(p_utilisateur uuid, p_heures integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant timestamptz;
begin
  perform public.exiger_admin();
  if p_heures is null or p_heures < 0 or p_heures > 24 * 365 then
    raise exception 'Durée invalide.' using hint = 'hors_limites';
  end if;
  if not exists (select 1 from public.utilisateurs where id = p_utilisateur) then
    raise exception 'Utilisateur introuvable.' using hint = 'utilisateur_introuvable';
  end if;
  select jusqu into v_avant from public.blocages_chat where utilisateur_id = p_utilisateur for update;
  if p_heures = 0 then
    delete from public.blocages_chat where utilisateur_id = p_utilisateur;
  else
    insert into public.blocages_chat (utilisateur_id, jusqu, bloque_par) values (p_utilisateur, now() + make_interval(hours => p_heures), auth.uid())
    on conflict (utilisateur_id) do update set jusqu = excluded.jusqu, bloque_par = excluded.bloque_par, bloque_le = now();
  end if;
  perform public.journaliser_detail(case when p_heures = 0 then 'chat_debloque' else 'chat_bloque' end, p_utilisateur, null,
    jsonb_build_object('jusqu', v_avant), jsonb_build_object('heures', p_heures));
end;
$$;

-- Admin : liste des mots interdits
create function public.ajouter_mot_interdit(p_mot text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mot text := public.sans_accents(lower(btrim(regexp_replace(coalesce(p_mot, ''), '\s+', ' ', 'g'))));
begin
  perform public.exiger_admin();
  if v_mot !~ '^[a-z0-9'' -]{2,40}$' then
    raise exception 'Mot invalide.' using hint = 'hors_limites';
  end if;
  insert into public.mots_interdits (mot, cree_par) values (v_mot, auth.uid()) on conflict (mot) do nothing;
  perform public.journaliser_detail('mot_interdit_ajoute', null, null, null, jsonb_build_object('mot', v_mot));
end;
$$;

create function public.retirer_mot_interdit(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mot text;
begin
  perform public.exiger_admin();
  delete from public.mots_interdits where id = p_id returning mot into v_mot;
  if v_mot is not null then
    perform public.journaliser_detail('mot_interdit_retire', null, null, jsonb_build_object('mot', v_mot), null);
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Droits, Row Level Security, Realtime
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['public.filtrer_texte(text)', 'public.masquer_message_interne(bigint, text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.envoyer_message(bigint, bigint, text)', 'public.signaler(bigint, bigint, text, text)',
                           'public.masquer_message(bigint, text)', 'public.retablir_message(bigint)', 'public.traiter_signalement(bigint, text)',
                           'public.bloquer_chat(uuid, integer)', 'public.ajouter_mot_interdit(text)', 'public.retirer_mot_interdit(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

alter table public.messages_chat    enable row level security;
alter table public.messages_masques enable row level security;
alter table public.mots_interdits   enable row level security;
alter table public.signalements     enable row level security;
alter table public.blocages_chat    enable row level security;
revoke all on table public.messages_chat, public.messages_masques, public.mots_interdits, public.signalements, public.blocages_chat from anon, authenticated;

-- Les salons sont publics en lecture (les messages masqués n'ont plus de texte)
grant select on table public.messages_chat to anon, authenticated;
create policy "Messages lisibles par tous" on public.messages_chat for select to anon, authenticated using (true);

grant select on table public.messages_masques to authenticated;
create policy "Textes masqués réservés aux admins" on public.messages_masques for select to authenticated using ((select public.est_admin()));

grant select on table public.mots_interdits to authenticated;
create policy "Mots interdits réservés aux admins" on public.mots_interdits for select to authenticated using ((select public.est_admin()));

grant select on table public.signalements to authenticated;
create policy "Mes signalements, ou tous pour les admins" on public.signalements for select to authenticated
  using (auteur_id = (select auth.uid()) or (select public.est_admin()));

grant select on table public.blocages_chat to authenticated;
create policy "Mon blocage, ou tous pour les admins" on public.blocages_chat for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

-- Messages en direct (Supabase Realtime, Row Level Security appliquée)
alter publication supabase_realtime add table public.messages_chat;
