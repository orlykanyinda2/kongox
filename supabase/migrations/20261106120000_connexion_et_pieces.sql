-- =====================================================================
-- KongoX — Étape 1 : utilisateurs, coordonnées et pièces
-- =====================================================================
-- Règle d'or : les pièces ne bougent QUE par la fonction mouvement_pieces(),
-- dans une transaction PostgreSQL. Le navigateur ne peut ni écrire le solde,
-- ni écrire dans transactions_pieces.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Table des utilisateurs (profil public)
-- ---------------------------------------------------------------------
create table public.utilisateurs (
  id               uuid primary key references auth.users (id) on delete cascade,
  nom_utilisateur  text        not null,
  role             text        not null default 'utilisateur',
  solde_pieces     bigint      not null default 0,
  serie_jours      integer     not null default 0,
  dernier_bonus_le date,                                   -- jour (heure de Kinshasa) du dernier bonus quotidien
  badges           text[]      not null default '{}',      -- ex. « Créateur de marché »
  cree_le          timestamptz not null default now(),

  constraint utilisateurs_nom_format check (nom_utilisateur ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint utilisateurs_role_valide check (role in ('utilisateur', 'curateur', 'admin')),
  constraint utilisateurs_solde_positif check (solde_pieces >= 0),
  constraint utilisateurs_serie_positive check (serie_jours >= 0)
);

-- Un nom d'utilisateur est unique sans tenir compte des majuscules
create unique index utilisateurs_nom_unique on public.utilisateurs (lower(nom_utilisateur));

comment on table public.utilisateurs is 'Profil public de chaque compte KongoX. Le solde ne change que par mouvement_pieces().';


-- ---------------------------------------------------------------------
-- 2. Coordonnées privées (e-mail de contact et téléphone, facultatifs)
-- ---------------------------------------------------------------------
-- Séparées du profil public : seuls le propriétaire et les admins les voient.
-- L'e-mail de Supabase Auth (nom@kongox.local) n'est jamais affiché ; le vrai
-- e-mail de l'utilisateur va ici, dans email_contact.
create table public.coordonnees_utilisateurs (
  utilisateur_id uuid primary key references public.utilisateurs (id) on delete cascade,
  email_contact  text,
  telephone      text,                                     -- format +243812345678
  modifie_le     timestamptz not null default now(),

  constraint coordonnees_email_format check (
    email_contact is null
    or (length(email_contact) <= 254 and email_contact ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  constraint coordonnees_telephone_format check (telephone is null or telephone ~ '^\+[0-9]{8,15}$'),
  -- Un cadeau par numéro : un numéro ne peut appartenir qu'à un seul compte
  constraint coordonnees_telephone_unique unique (telephone)
);

comment on table public.coordonnees_utilisateurs is 'Coordonnées privées. Visibles uniquement par le propriétaire (RLS) et les admins (clé service role).';


-- ---------------------------------------------------------------------
-- 3. Journal des pièces (jamais modifié)
-- ---------------------------------------------------------------------
create table public.transactions_pieces (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  montant        bigint      not null,                     -- positif = gain, négatif = dépense
  type           text        not null,
  solde_apres    bigint      not null,
  description    text,
  cree_le        timestamptz not null default now(),

  constraint transactions_montant_non_nul check (montant <> 0),
  constraint transactions_solde_positif check (solde_apres >= 0),
  -- Les étapes suivantes ajouteront leurs types (mise, gain, question approuvée…)
  constraint transactions_type_valide check (type in ('inscription', 'bonus_quotidien', 'bonus_serie'))
);

create index transactions_pieces_utilisateur_date on public.transactions_pieces (utilisateur_id, cree_le desc);

comment on table public.transactions_pieces is 'Chaque mouvement de pièces. Une ligne écrite ne change plus jamais.';

-- Une transaction écrite ne peut plus être modifiée, même par un admin
create function public.interdire_modification_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Une transaction de pièces ne peut jamais être modifiée.';
end;
$$;

create trigger transactions_pieces_immuables
  before update on public.transactions_pieces
  for each row execute function public.interdire_modification_transaction();

-- Date de modification des coordonnées
create function public.maj_date_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger coordonnees_date_modification
  before update on public.coordonnees_utilisateurs
  for each row execute function public.maj_date_modification();


-- ---------------------------------------------------------------------
-- 4. Fonction interne : seul chemin pour faire bouger des pièces
-- ---------------------------------------------------------------------
-- Met à jour le solde ET écrit la ligne du journal dans la même transaction.
-- Si le solde devenait négatif, la contrainte annule tout.
-- Pas appelable depuis le navigateur (execute retiré plus bas).
create function public.mouvement_pieces(
  p_utilisateur uuid,
  p_montant     bigint,
  p_type        text,
  p_description text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solde bigint;
begin
  if p_montant is null or p_montant = 0 then
    raise exception 'Montant de pièces invalide.';
  end if;

  update public.utilisateurs
     set solde_pieces = solde_pieces + p_montant
   where id = p_utilisateur
  returning solde_pieces into v_solde;

  if not found then
    raise exception 'Utilisateur introuvable.';
  end if;

  insert into public.transactions_pieces (utilisateur_id, montant, type, solde_apres, description)
  values (p_utilisateur, p_montant, p_type, v_solde, p_description);

  return v_solde;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Création du profil + 1 000 pièces à l'inscription
-- ---------------------------------------------------------------------
-- Déclenché dans la MÊME transaction que la création du compte Auth :
-- soit tout est créé (compte, profil, coordonnées, 1 000 pièces), soit rien.
create function public.creer_profil_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := new.raw_user_meta_data ->> 'nom_utilisateur';
begin
  -- Seuls les comptes créés par le formulaire KongoX (adresse cachée nom@kongox.local) sont acceptés
  if v_nom is null or new.email is distinct from lower(v_nom) || '@kongox.local' then
    raise exception 'Inscription refusée : le compte doit être créé depuis KongoX.';
  end if;

  insert into public.utilisateurs (id, nom_utilisateur) values (new.id, v_nom);
  insert into public.coordonnees_utilisateurs (utilisateur_id) values (new.id);
  perform public.mouvement_pieces(new.id, 1000, 'inscription', 'Bienvenue sur KongoX : 1 000 pièces offertes');

  return new;
end;
$$;

create trigger apres_creation_compte
  after insert on auth.users
  for each row execute function public.creer_profil_utilisateur();


-- ---------------------------------------------------------------------
-- 6. Bonus quotidien (100 pièces) et série de connexion
-- ---------------------------------------------------------------------
-- Une fois par jour (jour de Kinshasa). La série compte les jours consécutifs :
-- si l'utilisateur rate un jour, elle retombe à 0 puis recommence à 1.
-- Tous les 7 jours de suite (7, 14, 21…) : +200 pièces bonus en plus.
create function public.reclamer_bonus_quotidien()
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
  v_bonus_serie integer := 0;
begin
  if v_id is null then
    raise exception 'Connexion requise.';
  end if;

  -- Verrou sur la ligne : deux appels en même temps ne peuvent pas donner deux bonus
  select dernier_bonus_le, serie_jours, solde_pieces
    into v_dernier, v_serie, v_solde
    from public.utilisateurs
   where id = v_id
     for update;

  if not found then
    raise exception 'Profil introuvable.';
  end if;

  -- Déjà reçu aujourd'hui
  if v_dernier = v_aujourdhui then
    return jsonb_build_object('accorde', false, 'bonus', 0, 'bonus_serie', 0, 'serie_jours', v_serie, 'solde', v_solde);
  end if;

  -- Hier = la série continue ; sinon elle repart de 1
  if v_dernier = v_aujourdhui - 1 then
    v_serie := v_serie + 1;
  else
    v_serie := 1;
  end if;

  update public.utilisateurs
     set serie_jours = v_serie,
         dernier_bonus_le = v_aujourdhui
   where id = v_id;

  v_solde := public.mouvement_pieces(v_id, 100, 'bonus_quotidien',
                                     'Bonus de connexion du ' || to_char(v_aujourdhui, 'DD/MM/YYYY'));

  if v_serie % 7 = 0 then
    v_bonus_serie := 200;
    v_solde := public.mouvement_pieces(v_id, 200, 'bonus_serie', 'Série de ' || v_serie || ' jours');
  end if;

  return jsonb_build_object('accorde', true, 'bonus', 100, 'bonus_serie', v_bonus_serie, 'serie_jours', v_serie, 'solde', v_solde);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Le nom d'utilisateur est-il libre ? (sans tenir compte des majuscules)
-- ---------------------------------------------------------------------
create function public.nom_utilisateur_disponible(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.utilisateurs where lower(nom_utilisateur) = lower(p_nom));
$$;


-- ---------------------------------------------------------------------
-- 8. Droits d'exécution des fonctions
-- ---------------------------------------------------------------------
-- Par défaut, PostgreSQL permet à tout le monde d'exécuter une fonction : on retire.
revoke execute on function public.mouvement_pieces(uuid, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.creer_profil_utilisateur() from public, anon, authenticated;
revoke execute on function public.interdire_modification_transaction() from public, anon, authenticated;
revoke execute on function public.maj_date_modification() from public, anon, authenticated;

revoke execute on function public.reclamer_bonus_quotidien() from public, anon;
grant  execute on function public.reclamer_bonus_quotidien() to authenticated;

revoke execute on function public.nom_utilisateur_disponible(text) from public;
grant  execute on function public.nom_utilisateur_disponible(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 9. Row Level Security et droits sur les tables
-- ---------------------------------------------------------------------
alter table public.utilisateurs             enable row level security;
alter table public.coordonnees_utilisateurs enable row level security;
alter table public.transactions_pieces      enable row level security;

-- On retire tous les droits donnés par défaut par Supabase, puis on rend seulement le nécessaire.
revoke all on table public.utilisateurs             from anon, authenticated;
revoke all on table public.coordonnees_utilisateurs from anon, authenticated;
revoke all on table public.transactions_pieces      from anon, authenticated;

-- utilisateurs : profil public, lisible par tous, jamais écrit par le navigateur
grant select on table public.utilisateurs to anon, authenticated;
create policy "Les profils sont publics"
  on public.utilisateurs for select
  to anon, authenticated
  using (true);

-- coordonnees_utilisateurs : chacun lit et modifie seulement les siennes,
-- et seulement les colonnes email_contact et telephone
grant select on table public.coordonnees_utilisateurs to authenticated;
grant update (email_contact, telephone) on table public.coordonnees_utilisateurs to authenticated;
create policy "Je lis mes coordonnées"
  on public.coordonnees_utilisateurs for select
  to authenticated
  using ((select auth.uid()) = utilisateur_id);
create policy "Je modifie mes coordonnées"
  on public.coordonnees_utilisateurs for update
  to authenticated
  using ((select auth.uid()) = utilisateur_id)
  with check ((select auth.uid()) = utilisateur_id);

-- transactions_pieces : chacun lit seulement son historique, personne n'écrit
grant select on table public.transactions_pieces to authenticated;
create policy "Je lis mes transactions"
  on public.transactions_pieces for select
  to authenticated
  using ((select auth.uid()) = utilisateur_id);
