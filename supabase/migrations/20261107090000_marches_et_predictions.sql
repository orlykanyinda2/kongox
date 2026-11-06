-- =====================================================================
-- KongoX — Étape 2 : marchés, options, prédictions, cagnotte et gains
-- =====================================================================
-- Système de cagnotte (pari mutuel) : les pièces misées vont dans
-- options_marche.total_mise. Au règlement, les gagnants se partagent toute
-- la cagnotte du marché au prorata de leur mise. Aucune pièce n'est créée
-- ni perdue : les restes de la division sont distribués un par un.
-- Toutes les écritures passent par des fonctions SQL en transaction.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Marchés
-- ---------------------------------------------------------------------
create table public.marches (
  id                 bigint generated always as identity primary key,
  question           text        not null,
  categorie          text        not null,
  type_reponse       text        not null default 'oui_non',
  date_fin           timestamptz not null,
  source             text        not null,
  statut             text        not null default 'en_attente',
  auteur_id          uuid        references public.utilisateurs (id) on delete set null,
  soki_du_jour       boolean     not null default false,   -- question mise en avant sur l'accueil
  motif              text,                                  -- motif de refus ou d'annulation
  option_gagnante_id bigint,                                -- clé étrangère ajoutée plus bas
  lien_resultat      text,                                  -- lien de la source qui prouve le résultat
  examine_par        uuid        references public.utilisateurs (id) on delete set null,
  examine_le         timestamptz,
  regle_le           timestamptz,
  cree_le            timestamptz not null default now(),

  constraint marches_question_longueur check (char_length(question) between 15 and 200),
  constraint marches_source_longueur check (char_length(source) between 3 and 200),
  constraint marches_categorie_valide check (categorie in ('football', 'musique', 'politique', 'vie_quotidienne')),
  constraint marches_type_valide check (type_reponse in ('oui_non', 'choix_multiples')),
  constraint marches_statut_valide check (statut in ('en_attente', 'approuve', 'refuse', 'ferme', 'regle'))
);

create index marches_statut_fin on public.marches (statut, date_fin);
create index marches_auteur on public.marches (auteur_id);

comment on table public.marches is 'Questions des marchés. Statuts : en_attente → approuve / refuse → ferme → regle.';


-- ---------------------------------------------------------------------
-- 2. Options d'un marché (OUI / NON pour l'instant) et cagnotte de chaque côté
-- ---------------------------------------------------------------------
create table public.options_marche (
  id         bigint generated always as identity primary key,
  marche_id  bigint   not null references public.marches (id) on delete restrict,
  libelle    text     not null,
  ordre      smallint not null default 0,                   -- 0 = OUI, 1 = NON
  total_mise bigint   not null default 0,

  constraint options_total_positif check (total_mise >= 0),
  constraint options_libelle_unique unique (marche_id, libelle)
);

create index options_marche_marche on public.options_marche (marche_id, ordre);

alter table public.marches
  add constraint marches_option_gagnante_fk foreign key (option_gagnante_id) references public.options_marche (id);


-- ---------------------------------------------------------------------
-- 3. Prédictions (mises)
-- ---------------------------------------------------------------------
create table public.predictions (
  id             bigint generated always as identity primary key,
  utilisateur_id uuid        not null references public.utilisateurs (id) on delete cascade,
  marche_id      bigint      not null references public.marches (id) on delete restrict,
  option_id      bigint      not null references public.options_marche (id) on delete restrict,
  montant        bigint      not null,
  statut         text        not null default 'en_cours',
  gain           bigint      not null default 0,             -- pièces reçues au règlement
  cree_le        timestamptz not null default now(),

  constraint predictions_montant_positif check (montant > 0),
  constraint predictions_gain_positif check (gain >= 0),
  constraint predictions_statut_valide check (statut in ('en_cours', 'gagnee', 'perdue', 'remboursee'))
);

create index predictions_marche on public.predictions (marche_id, cree_le);
create index predictions_utilisateur on public.predictions (utilisateur_id, cree_le desc);


-- ---------------------------------------------------------------------
-- 4. Journal des pièces : nouveaux types et lien vers le marché
-- ---------------------------------------------------------------------
alter table public.transactions_pieces drop constraint transactions_type_valide;
alter table public.transactions_pieces add constraint transactions_type_valide check (
  type in ('inscription', 'bonus_quotidien', 'bonus_serie', 'mise', 'gain', 'remboursement', 'question_approuvee')
);
alter table public.transactions_pieces
  add column marche_id bigint references public.marches (id) on delete set null;

-- Pour calculer vite la limite quotidienne de mise
create index transactions_pieces_mises on public.transactions_pieces (utilisateur_id, type, cree_le);

-- mouvement_pieces reçoit maintenant le marché concerné (facultatif)
drop function public.mouvement_pieces(uuid, bigint, text, text);

create function public.mouvement_pieces(
  p_utilisateur uuid,
  p_montant     bigint,
  p_type        text,
  p_description text   default null,
  p_marche      bigint default null
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

  insert into public.transactions_pieces (utilisateur_id, montant, type, solde_apres, description, marche_id)
  values (p_utilisateur, p_montant, p_type, v_solde, p_description, p_marche);

  return v_solde;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Outils
-- ---------------------------------------------------------------------
-- L'utilisateur connecté est-il admin ? (les curateurs arrivent à l'étape 3)
create function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.utilisateurs where id = auth.uid() and role = 'admin');
$$;

-- Limite de pièces misées par jour (jour de Kinshasa)
create function public.limite_mise_quotidienne()
returns bigint
language sql
immutable
as $$ select 2000::bigint $$;

-- Pièces déjà misées aujourd'hui par un utilisateur
create function public.mises_du_jour(p_utilisateur uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(-montant), 0)::bigint
    from public.transactions_pieces
   where utilisateur_id = p_utilisateur
     and type = 'mise'
     and cree_le >= ((now() at time zone 'Africa/Kinshasa')::date::timestamp at time zone 'Africa/Kinshasa');
$$;

-- Ce qu'il reste à miser aujourd'hui pour l'utilisateur connecté
create function public.mise_restante_aujourdhui()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(public.limite_mise_quotidienne() - public.mises_du_jour(auth.uid()), 0);
$$;


-- ---------------------------------------------------------------------
-- 6. Proposer une question (statut en_attente)
-- ---------------------------------------------------------------------
create function public.proposer_marche(
  p_question  text,
  p_categorie text,
  p_date_fin  timestamptz,
  p_source    text
)
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
  if char_length(v_question) < 15 or char_length(v_question) > 200 or right(v_question, 1) <> '?' then
    raise exception 'Question invalide.' using hint = 'question_invalide';
  end if;
  if p_categorie not in ('football', 'musique', 'politique', 'vie_quotidienne') then
    raise exception 'Catégorie invalide.' using hint = 'categorie_invalide';
  end if;
  if p_date_fin is null or p_date_fin < now() + interval '24 hours' or p_date_fin > now() + interval '2 years' then
    raise exception 'Date de fin invalide.' using hint = 'date_invalide';
  end if;
  if char_length(v_source) < 3 or char_length(v_source) > 200 then
    raise exception 'Source invalide.' using hint = 'source_invalide';
  end if;
  -- Pas plus de 5 questions en attente par personne
  if (select count(*) from public.marches where auteur_id = v_id and statut = 'en_attente') >= 5 then
    raise exception 'Trop de questions en attente.' using hint = 'trop_de_propositions';
  end if;

  insert into public.marches (question, categorie, date_fin, source, auteur_id)
  values (v_question, p_categorie, p_date_fin, v_source, v_id)
  returning id into v_marche;

  insert into public.options_marche (marche_id, libelle, ordre)
  values (v_marche, 'OUI', 0), (v_marche, 'NON', 1);

  return v_marche;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Placer une prédiction (miser des pièces)
-- ---------------------------------------------------------------------
-- Ordre des verrous : marché puis utilisateur (le même que le règlement).
create function public.placer_prediction(
  p_marche  bigint,
  p_option  bigint,
  p_montant bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := auth.uid();
  v_marche   public.marches%rowtype;
  v_solde    bigint;
  v_deja     bigint;
  v_libelle  text;
  v_pred     bigint;
begin
  if v_id is null then
    raise exception 'Connexion requise.' using hint = 'connexion_requise';
  end if;
  if p_montant is null or p_montant < 10 then
    raise exception 'Montant invalide.' using hint = 'montant_invalide';
  end if;

  -- Verrou partagé : empêche un règlement pendant la mise
  select * into v_marche from public.marches where id = p_marche for share;
  if not found or v_marche.statut <> 'approuve' or v_marche.date_fin <= now() then
    raise exception 'Ce marché est fermé.' using hint = 'marche_ferme';
  end if;

  select libelle into v_libelle from public.options_marche where id = p_option and marche_id = p_marche;
  if not found then
    raise exception 'Option invalide.' using hint = 'option_invalide';
  end if;

  -- Verrou sur l'utilisateur : deux mises en même temps ne dépassent pas la limite
  select solde_pieces into v_solde from public.utilisateurs where id = v_id for update;
  if not found then
    raise exception 'Profil introuvable.' using hint = 'connexion_requise';
  end if;

  v_deja := public.mises_du_jour(v_id);
  if v_deja + p_montant > public.limite_mise_quotidienne() then
    raise exception 'Limite quotidienne atteinte.' using hint = 'limite_quotidienne',
      detail = greatest(public.limite_mise_quotidienne() - v_deja, 0)::text;
  end if;
  if v_solde < p_montant then
    raise exception 'Solde insuffisant.' using hint = 'solde_insuffisant';
  end if;

  v_solde := public.mouvement_pieces(v_id, -p_montant, 'mise',
                                     v_libelle || ' : ' || v_marche.question, p_marche);

  update public.options_marche set total_mise = total_mise + p_montant where id = p_option;

  insert into public.predictions (utilisateur_id, marche_id, option_id, montant)
  values (v_id, p_marche, p_option, p_montant)
  returning id into v_pred;

  return jsonb_build_object(
    'prediction_id', v_pred,
    'solde', v_solde,
    'restant_aujourdhui', public.limite_mise_quotidienne() - v_deja - p_montant
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Approuver / refuser une question (admin ; curateurs à l'étape 3)
-- ---------------------------------------------------------------------
-- Approuver donne +50 pièces et le badge « Créateur de marché » à l'auteur.
create function public.approuver_marche(p_marche bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche public.marches%rowtype;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;

  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut <> 'en_attente' then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;

  update public.marches
     set statut = 'approuve', examine_par = auth.uid(), examine_le = now()
   where id = p_marche;

  if v_marche.auteur_id is not null then
    perform public.mouvement_pieces(v_marche.auteur_id, 50, 'question_approuvee',
                                    'Question approuvée : ' || v_marche.question, p_marche);
    update public.utilisateurs
       set badges = array_append(badges, 'Créateur de marché')
     where id = v_marche.auteur_id
       and not ('Créateur de marché' = any (badges));
  end if;
end;
$$;

create function public.refuser_marche(p_marche bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;

  update public.marches
     set statut = 'refuse', motif = nullif(btrim(p_motif), ''), examine_par = auth.uid(), examine_le = now()
   where id = p_marche and statut = 'en_attente';

  if not found then
    raise exception 'Cette question n''est pas en attente.' using hint = 'statut_invalide';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Fermer les marchés dont la date de fin est passée
-- ---------------------------------------------------------------------
create function public.fermer_marches_echus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nb integer;
begin
  update public.marches set statut = 'ferme' where statut = 'approuve' and date_fin <= now();
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Rembourser toutes les mises d'un marché (fonction interne)
-- ---------------------------------------------------------------------
create function public.rembourser_marche(p_marche bigint, p_question text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  for p in select id, utilisateur_id, montant from public.predictions
            where marche_id = p_marche and statut = 'en_cours' order by id
  loop
    perform public.mouvement_pieces(p.utilisateur_id, p.montant, 'remboursement',
                                    'Remboursement : ' || p_question, p_marche);
    update public.predictions set statut = 'remboursee', gain = p.montant where id = p.id;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. Régler un marché : verser la cagnotte aux gagnants
-- ---------------------------------------------------------------------
-- Gain de chaque gagnant = sa mise × cagnotte totale ÷ total misé sur la bonne réponse,
-- arrondi vers le bas. Les pièces restantes (restes de la division) sont données
-- une par une aux plus grands restes : la somme des gains = la cagnotte, exactement.
-- Si personne n'a misé sur la bonne réponse, tout le monde est remboursé.
create function public.regler_marche(p_marche bigint, p_option_gagnante bigint, p_lien_resultat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche     public.marches%rowtype;
  v_cagnotte   bigint;
  v_gagnant    bigint;
  v_distribue  bigint;
  v_reste      bigint;
  v_libelle    text;
  g            record;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;
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
     set statut = 'regle', option_gagnante_id = p_option_gagnante,
         lien_resultat = btrim(p_lien_resultat), regle_le = now()
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
      perform public.mouvement_pieces(g.utilisateur_id, g.gain, 'gain',
                                      'Gagné (' || v_libelle || ') : ' || v_marche.question, p_marche);
    end if;
    update public.predictions set statut = 'gagnee', gain = g.gain where id = g.id;
  end loop;

  update public.predictions set statut = 'perdue'
   where marche_id = p_marche and option_id <> p_option_gagnante and statut = 'en_cours';

  return jsonb_build_object('cagnotte', v_cagnotte, 'gagnants',
                            (select count(*) from public.predictions where marche_id = p_marche and statut = 'gagnee'),
                            'rembourse', false);
end;
$$;


-- ---------------------------------------------------------------------
-- 12. Annuler un marché (réponse impossible à vérifier) : tout le monde est remboursé
-- ---------------------------------------------------------------------
create function public.annuler_marche(p_marche bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marche public.marches%rowtype;
begin
  if not public.est_admin() then
    raise exception 'Réservé aux admins.' using hint = 'reserve_admin';
  end if;

  select * into v_marche from public.marches where id = p_marche for update;
  if not found or v_marche.statut not in ('approuve', 'ferme') then
    raise exception 'Ce marché ne peut pas être annulé.' using hint = 'statut_invalide';
  end if;

  update public.marches
     set statut = 'regle', option_gagnante_id = null, motif = nullif(btrim(p_motif), ''), regle_le = now()
   where id = p_marche;

  perform public.rembourser_marche(p_marche, v_marche.question);
end;
$$;


-- ---------------------------------------------------------------------
-- 13. Évolution du pourcentage OUI (pour le graphique)
-- ---------------------------------------------------------------------
-- Un point après chaque mise. Ne révèle ni qui a misé ni combien.
create function public.historique_marche(p_marche bigint, p_depuis timestamptz default null)
returns table (moment timestamptz, pourcentage_oui numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select id from public.marches where id = p_marche and statut in ('approuve', 'ferme', 'regle')
  ),
  oui as (
    select o.id from public.options_marche o join m on m.id = o.marche_id where o.ordre = 0
  ),
  cumul as (
    select p.cree_le,
           sum(case when p.option_id = (select id from oui) then p.montant else 0 end) over w as total_oui,
           sum(p.montant) over w as total
      from public.predictions p join m on m.id = p.marche_id
    window w as (order by p.cree_le, p.id rows between unbounded preceding and current row)
  )
  select cree_le, round(100.0 * total_oui / nullif(total, 0), 1)
    from cumul
   where p_depuis is null or cree_le >= p_depuis
   order by cree_le;
$$;


-- ---------------------------------------------------------------------
-- 14. Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.mouvement_pieces(uuid, bigint, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.rembourser_marche(bigint, text) from public, anon, authenticated;
revoke execute on function public.mises_du_jour(uuid) from public, anon, authenticated;
revoke execute on function public.limite_mise_quotidienne() from public, anon, authenticated;

revoke execute on function public.est_admin() from public;
revoke execute on function public.mise_restante_aujourdhui() from public, anon;
revoke execute on function public.proposer_marche(text, text, timestamptz, text) from public, anon;
revoke execute on function public.placer_prediction(bigint, bigint, bigint) from public, anon;
revoke execute on function public.approuver_marche(bigint) from public, anon;
revoke execute on function public.refuser_marche(bigint, text) from public, anon;
revoke execute on function public.regler_marche(bigint, bigint, text) from public, anon;
revoke execute on function public.annuler_marche(bigint, text) from public, anon;
grant execute on function public.est_admin() to anon, authenticated;   -- utilisée par la RLS ; renvoie faux sans connexion
grant execute on function public.mise_restante_aujourdhui() to authenticated;
grant execute on function public.proposer_marche(text, text, timestamptz, text) to authenticated;
grant execute on function public.placer_prediction(bigint, bigint, bigint) to authenticated;
grant execute on function public.approuver_marche(bigint) to authenticated;   -- vérifie est_admin()
grant execute on function public.refuser_marche(bigint, text) to authenticated;
grant execute on function public.regler_marche(bigint, bigint, text) to authenticated;
grant execute on function public.annuler_marche(bigint, text) to authenticated;

revoke execute on function public.fermer_marches_echus() from public;
grant execute on function public.fermer_marches_echus() to anon, authenticated;   -- sans danger : ferme seulement les marchés échus
revoke execute on function public.historique_marche(bigint, timestamptz) from public;
grant execute on function public.historique_marche(bigint, timestamptz) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 15. Row Level Security
-- ---------------------------------------------------------------------
alter table public.marches        enable row level security;
alter table public.options_marche enable row level security;
alter table public.predictions    enable row level security;

revoke all on table public.marches        from anon, authenticated;
revoke all on table public.options_marche from anon, authenticated;
revoke all on table public.predictions    from anon, authenticated;

grant select on table public.marches        to anon, authenticated;
grant select on table public.options_marche to anon, authenticated;
grant select on table public.predictions    to authenticated;

-- Marchés publiés visibles par tous ; ses propres propositions et toute la file pour les admins
create policy "Marchés publiés visibles"
  on public.marches for select
  to anon, authenticated
  using (
    statut in ('approuve', 'ferme', 'regle')
    or auteur_id = (select auth.uid())
    or (select public.est_admin())
  );

-- Une option est visible si son marché l'est
create policy "Options des marchés visibles"
  on public.options_marche for select
  to anon, authenticated
  using (exists (select 1 from public.marches m where m.id = marche_id));

-- Chacun voit seulement ses propres prédictions
create policy "Je lis mes prédictions"
  on public.predictions for select
  to authenticated
  using ((select auth.uid()) = utilisateur_id);
