-- =====================================================================
-- KongoX — Étape 6 : partage, partenaires et cadeaux
-- =====================================================================
-- - Demandes de partenariat (page « Devenir partenaire de KongoX »)
-- - Sponsor d'un marché (« Question offerte par… ») et d'un cadeau
-- - Cadeaux : un cadeau par numéro, derniers gagnants publics
-- Le partage (liens, cartes image, Open Graph) se fait côté application.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Demandes de partenariat
-- ---------------------------------------------------------------------
create table public.demandes_partenaires (
  id           bigint generated always as identity primary key,
  nom          text        not null,
  organisation text,
  type         text        not null,
  contact      text        not null,           -- numéro WhatsApp ou e-mail, pour répondre
  message      text        not null,
  statut       text        not null default 'nouvelle',
  note         text,                            -- note interne de l'équipe
  utilisateur_id uuid      references public.utilisateurs (id) on delete set null,   -- si la personne était connectée
  traite_par   uuid        references public.utilisateurs (id) on delete set null,
  traite_le    timestamptz,
  cree_le      timestamptz not null default now(),
  constraint demandes_type_valide check (type in ('marque', 'sponsor_cadeaux', 'curateur', 'influenceur', 'media', 'pronostiqueur', 'chercheur', 'autre')),
  constraint demandes_statut_valide check (statut in ('nouvelle', 'en_cours', 'traitee', 'archivee')),
  constraint demandes_nom_longueur check (char_length(nom) between 2 and 80),
  constraint demandes_organisation_longueur check (organisation is null or char_length(organisation) <= 120),
  constraint demandes_contact_longueur check (char_length(contact) between 5 and 120),
  constraint demandes_message_longueur check (char_length(message) between 10 and 2000),
  constraint demandes_note_longueur check (note is null or char_length(note) <= 1000)
);
create index demandes_partenaires_statut on public.demandes_partenaires (statut, cree_le desc);

-- Envoi d'une demande (visiteurs compris). Limites anti-abus : 30 demandes par heure en tout,
-- 3 par jour pour un même contact.
create function public.envoyer_demande_partenaire(p_nom text, p_organisation text, p_type text, p_contact text, p_message text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact text := btrim(regexp_replace(coalesce(p_contact, ''), '\s+', ' ', 'g'));
  v_id bigint;
begin
  if p_type not in ('marque', 'sponsor_cadeaux', 'curateur', 'influenceur', 'media', 'pronostiqueur', 'chercheur', 'autre') then
    raise exception 'Type invalide.' using hint = 'demande_invalide';
  end if;
  if char_length(btrim(coalesce(p_nom, ''))) not between 2 and 80
     or char_length(btrim(coalesce(p_message, ''))) not between 10 and 2000
     or char_length(btrim(coalesce(p_organisation, ''))) > 120 then
    raise exception 'Champs invalides.' using hint = 'demande_invalide';
  end if;
  -- Un numéro (8 à 15 chiffres, + facultatif) ou une adresse e-mail
  if v_contact !~ '^\+?[0-9 ]{8,20}$' and v_contact !~* '^[^@\s]{1,64}@[^@\s]{1,100}\.[a-z]{2,24}$' then
    raise exception 'Contact invalide.' using hint = 'contact_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('demandes_partenaires'));
  if (select count(*) from public.demandes_partenaires where cree_le > now() - interval '1 hour') >= 30
     or (select count(*) from public.demandes_partenaires where lower(contact) = lower(v_contact) and cree_le > now() - interval '24 hours') >= 3 then
    raise exception 'Trop de demandes.' using hint = 'demande_limite';
  end if;
  insert into public.demandes_partenaires (nom, organisation, type, contact, message, utilisateur_id)
  values (btrim(p_nom), nullif(btrim(coalesce(p_organisation, '')), ''), p_type, v_contact, btrim(p_message), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin : suivi d'une demande
create function public.traiter_demande_partenaire(p_demande bigint, p_statut text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant text;
begin
  perform public.exiger_admin();
  if p_statut not in ('nouvelle', 'en_cours', 'traitee', 'archivee') then
    raise exception 'Statut invalide.' using hint = 'statut_invalide';
  end if;
  select statut into v_avant from public.demandes_partenaires where id = p_demande for update;
  if not found then
    raise exception 'Demande introuvable.' using hint = 'statut_invalide';
  end if;
  update public.demandes_partenaires
     set statut = p_statut, note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 1000), ''), note), traite_par = auth.uid(), traite_le = now()
   where id = p_demande;
  perform public.journaliser_detail('demande_partenaire_' || p_statut, null, null,
    jsonb_build_object('demande', p_demande, 'statut', v_avant), jsonb_build_object('demande', p_demande, 'statut', p_statut));
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Sponsor d'un marché (« Question offerte par… »)
-- ---------------------------------------------------------------------
-- Modifiable à tout moment (même après des mises) : ne change ni la question ni la cagnotte.
create function public.definir_sponsor_marche(p_marche bigint, p_sponsor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant text;
  v_sponsor text := nullif(btrim(coalesce(p_sponsor, '')), '');
begin
  perform public.exiger_admin();
  if v_sponsor is not null and char_length(v_sponsor) not between 2 and 60 then
    raise exception 'Nom du sponsor invalide.' using hint = 'hors_limites';
  end if;
  select sponsor into v_avant from public.marches where id = p_marche for update;
  if not found then
    raise exception 'Marché introuvable.' using hint = 'statut_invalide';
  end if;
  update public.marches set sponsor = v_sponsor where id = p_marche;
  perform public.journaliser_detail('sponsor_marche', null, p_marche, jsonb_build_object('sponsor', v_avant), jsonb_build_object('sponsor', v_sponsor));
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Cadeaux
-- ---------------------------------------------------------------------
alter table public.cadeaux add column sponsor text;
alter table public.cadeaux add constraint cadeaux_sponsor_longueur check (sponsor is null or char_length(sponsor) between 2 and 60);
create index cadeaux_telephone on public.cadeaux (telephone) where statut = 'envoye';

-- Nouvelle version : sponsor facultatif (ex. « Offert par Vodacom »)
drop function public.creer_cadeau(text, text, text);
create function public.creer_cadeau(p_nom_utilisateur text, p_type text, p_description text, p_sponsor text default null)
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

-- « Un cadeau par numéro » : un numéro qui a déjà reçu un cadeau pour un autre compte est refusé
create or replace function public.marquer_cadeau_envoye(p_cadeau bigint)
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
  if exists (select 1 from public.cadeaux where statut = 'envoye' and telephone = v_tel and utilisateur_id <> c.utilisateur_id) then
    raise exception 'Numéro déjà récompensé.' using hint = 'numero_deja_recompense';
  end if;
  update public.cadeaux set statut = 'envoye', telephone = v_tel, envoye_par = auth.uid(), envoye_le = now() where id = c.id;
  perform public.journaliser('cadeau_envoye', c.utilisateur_id, null, jsonb_build_object('cadeau', c.id));
end;
$$;

-- Derniers gagnants (cadeaux envoyés depuis 60 jours) : nom, type, sponsor, date. Jamais le numéro.
create function public.derniers_gagnants(p_limite integer default 10)
returns table (nom_utilisateur text, type text, description text, sponsor text, envoye_le timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.nom_utilisateur, c.type, c.description, c.sponsor, c.envoye_le
    from public.cadeaux c join public.utilisateurs u on u.id = c.utilisateur_id
   where c.statut = 'envoye' and c.envoye_le > now() - interval '60 days'
   order by c.envoye_le desc
   limit least(greatest(coalesce(p_limite, 10), 1), 50);
$$;


-- ---------------------------------------------------------------------
-- 4. Droits et Row Level Security
-- ---------------------------------------------------------------------
revoke execute on function public.envoyer_demande_partenaire(text, text, text, text, text) from public;
grant execute on function public.envoyer_demande_partenaire(text, text, text, text, text) to anon, authenticated;
revoke execute on function public.derniers_gagnants(integer) from public;
grant execute on function public.derniers_gagnants(integer) to anon, authenticated;
do $$
declare
  f text;
begin
  foreach f in array array['public.traiter_demande_partenaire(bigint, text, text)', 'public.definir_sponsor_marche(bigint, text)',
                           'public.creer_cadeau(text, text, text, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

alter table public.demandes_partenaires enable row level security;
revoke all on table public.demandes_partenaires from anon, authenticated;
grant select on table public.demandes_partenaires to authenticated;
create policy "Demandes réservées aux admins" on public.demandes_partenaires for select to authenticated using ((select public.est_admin()));
