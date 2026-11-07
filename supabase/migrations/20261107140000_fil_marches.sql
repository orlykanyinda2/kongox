-- =====================================================================
-- KongoX — Fil de marchés (docs/ALGORITHME.md)
-- =====================================================================
-- Accueil en sections (Soki du jour, Tendances, Bientôt fermés, Nouveaux ;
-- phase 2 préparée mais désactivée : Pour toi, En forte hausse, Le Congo
-- est divisé), page /marches (recherche, filtres, tris), scores calculés
-- toutes les 10 minutes par pg_cron, mesure (evenements_fil) et indicateurs.
-- Seuls les marchés OUI / NON en ligne entrent dans le fil : les matchs
-- (1 N 2) ont leur propre section.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages du fil (coefficients et sections)
-- ---------------------------------------------------------------------
create table public.reglages_fil (
  cle         text primary key,
  groupe      text    not null,          -- coefficient | section | affichage
  libelle     text    not null,
  valeur      numeric not null,
  minimum     numeric not null,
  maximum     numeric not null,
  ordre       smallint not null default 0,
  modifie_par uuid    references public.utilisateurs (id) on delete set null,
  modifie_le  timestamptz not null default now(),
  constraint reglages_fil_groupe check (groupe in ('coefficient', 'section', 'affichage')),
  constraint reglages_fil_bornes check (valeur between minimum and maximum)
);

insert into public.reglages_fil (cle, groupe, libelle, valeur, minimum, maximum, ordre) values
  -- Score de tendance (ALGORITHME.md)
  ('coef_a',              'coefficient', 'A : poids des prédicteurs uniques (24 h)',             3,   0, 100, 1),
  ('coef_b',              'coefficient', 'B : poids des commentaires (24 h)',                     2,   0, 100, 2),
  ('coef_c',              'coefficient', 'C : pièces misées (24 h) divisées par C',             100,   1, 1000000, 3),
  ('coef_g',              'coefficient', 'G : vitesse de vieillissement',                       1.5,   0, 5, 4),
  ('coef_h',              'coefficient', 'H : durée du bonus des nouveaux marchés (heures)',      6,   0, 168, 5),
  ('bonus_nouveau',       'coefficient', 'Bonus des nouveaux marchés (ajouté au score)',          2,   0, 1000, 6),
  -- Phase 2
  ('momentum_seuil',      'coefficient', 'En forte hausse : momentum minimum',                    2,   0, 100, 7),
  ('momentum_min_1h',     'coefficient', 'En forte hausse : prédictions minimum dans l''heure',   3,   0, 1000, 8),
  ('variation_seuil',     'coefficient', 'En forte hausse : variation du OUI sur 24 h (points)', 10,   0, 100, 9),
  ('controverse_min',     'coefficient', 'Le Congo est divisé : prédicteurs minimum',             5,   0, 10000, 10),
  -- Sections (1 = affichée, 0 = cachée)
  ('section_soki',        'section', 'Soki du jour',             1, 0, 1, 20),
  ('section_pour_toi',    'section', 'Pour toi (phase 2)',       0, 0, 1, 21),
  ('section_tendances',   'section', 'Tendances',                1, 0, 1, 22),
  ('section_hausse',      'section', 'En forte hausse (phase 2)', 0, 0, 1, 23),
  ('section_bientot',     'section', 'Bientôt fermés',           1, 0, 1, 24),
  ('section_divise',      'section', 'Le Congo est divisé (phase 2)', 0, 0, 1, 25),
  ('section_nouveaux',    'section', 'Nouveaux',                 1, 0, 1, 26),
  -- Affichage
  ('taille_section',      'affichage', 'Marchés par section',                           6, 1, 24, 40),
  ('diversite_max',       'affichage', 'Diversité : même catégorie au maximum…',        2, 1, 24, 41),
  ('diversite_top',       'affichage', '… dans les N premiers d''une section',          6, 1, 24, 42),
  ('bientot_heures',      'affichage', 'Bientôt fermés : fermeture dans moins de (heures)', 24, 1, 720, 43);

create function public.reglage_fil(p_cle text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select valeur from public.reglages_fil where cle = p_cle $$;

create function public.modifier_reglage_fil(p_cle text, p_valeur numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reglages_fil%rowtype;
begin
  perform public.exiger_admin();
  select * into r from public.reglages_fil where cle = p_cle for update;
  if not found then
    raise exception 'Réglage inconnu.' using hint = 'statut_invalide';
  end if;
  if p_valeur is null or p_valeur < r.minimum or p_valeur > r.maximum then
    raise exception 'Valeur hors limites.' using hint = 'hors_limites';
  end if;
  update public.reglages_fil set valeur = p_valeur, modifie_par = auth.uid(), modifie_le = now() where cle = p_cle;
  perform public.journaliser_detail('reglage_fil_modifie', null, null,
    jsonb_build_object('cle', p_cle, 'valeur', r.valeur), jsonb_build_object('cle', p_cle, 'valeur', p_valeur));
end;
$$;

-- Marché sponsorisé : toujours affiché avec « Sponsorisé » (partenaires, étape 6)
alter table public.marches add column sponsor text;
alter table public.marches add constraint marches_sponsor_longueur check (sponsor is null or char_length(sponsor) between 2 and 60);


-- ---------------------------------------------------------------------
-- 2. Scores (recalculés toutes les 10 minutes)
-- ---------------------------------------------------------------------
create table public.scores_marches (
  marche_id          bigint primary key references public.marches (id) on delete cascade,
  score_tendance     numeric not null default 0,
  predicteurs_24h    integer not null default 0,
  commentaires_24h   integer not null default 0,
  pieces_24h         bigint  not null default 0,
  predicteurs_total  integer not null default 0,
  commentaires_total integer not null default 0,
  predictions_1h     integer not null default 0,
  momentum           numeric not null default 0,
  variation_oui_24h  numeric not null default 0,   -- points de pourcentage
  controverse        numeric not null default 0,
  calcule_le         timestamptz not null default now()
);
create index scores_marches_tendance on public.scores_marches (score_tendance desc);

-- Nombre de commentaires d'un marché depuis une date. Le chat (feat/chat) remplacera
-- cette fonction ; d'ici là il n'y a pas de commentaires (0).
create function public.commentaires_marche(p_marche bigint, p_depuis timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$ select 0 $$;

create function public.calculer_scores_fil()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a numeric := public.reglage_fil('coef_a');
  v_b numeric := public.reglage_fil('coef_b');
  v_c numeric := public.reglage_fil('coef_c');
  v_g numeric := public.reglage_fil('coef_g');
  v_h numeric := public.reglage_fil('coef_h');
  v_bonus numeric := public.reglage_fil('bonus_nouveau');
  v_nb integer;
begin
  with m as (
    select ma.id, coalesce(ma.date_publication, ma.examine_le, ma.cree_le) as publie_le,
           extract(epoch from now() - coalesce(ma.date_publication, ma.examine_le, ma.cree_le)) / 3600.0 as heures
      from public.marches ma
     where ma.statut = 'approuve' and ma.type_reponse = 'oui_non' and ma.date_fin > now()
  ),
  p as (
    select m.id,
           count(distinct pr.utilisateur_id) filter (where pr.cree_le > now() - interval '24 hours') as predicteurs_24h,
           coalesce(sum(pr.montant) filter (where pr.cree_le > now() - interval '24 hours'), 0) as pieces_24h,
           count(distinct pr.utilisateur_id) as predicteurs_total,
           count(*) filter (where pr.cree_le > now() - interval '1 hour') as predictions_1h,
           count(*) filter (where pr.cree_le > now() - interval '7 days') as predictions_7j,
           -- Pourcentage OUI maintenant et il y a 24 h (part des pièces)
           100.0 * coalesce(sum(pr.montant) filter (where o.ordre = 0), 0) / nullif(sum(pr.montant), 0) as oui_maintenant,
           100.0 * coalesce(sum(pr.montant) filter (where o.ordre = 0 and pr.cree_le <= now() - interval '24 hours'), 0)
             / nullif(sum(pr.montant) filter (where pr.cree_le <= now() - interval '24 hours'), 0) as oui_hier
      from m
      left join public.predictions pr on pr.marche_id = m.id
      left join public.options_marche o on o.id = pr.option_id
     group by m.id
  ),
  calc as (
    select m.id,
           p.predicteurs_24h, p.pieces_24h, p.predicteurs_total, p.predictions_1h,
           public.commentaires_marche(m.id, now() - interval '24 hours') as commentaires_24h,
           public.commentaires_marche(m.id, '-infinity') as commentaires_total,
           m.heures,
           -- momentum = prédictions de la dernière heure ÷ moyenne horaire sur 7 jours (ou depuis la publication)
           case when p.predictions_7j = 0 then 0
                else p.predictions_1h / (p.predictions_7j / greatest(least(m.heures, 168), 1)) end as momentum,
           coalesce(p.oui_maintenant - coalesce(p.oui_hier, 50), 0) as variation,
           coalesce(p.oui_maintenant, 50) / 100.0 as part_oui
      from m join p on p.id = m.id
  )
  insert into public.scores_marches as s (marche_id, score_tendance, predicteurs_24h, commentaires_24h, pieces_24h, predicteurs_total,
                                          commentaires_total, predictions_1h, momentum, variation_oui_24h, controverse, calcule_le)
  select id,
         -- score_tendance = activite ÷ (heures + 2)^G + bonus_nouveau pendant les H premières heures
         (v_a * predicteurs_24h + v_b * commentaires_24h + pieces_24h / v_c) / power(greatest(heures, 0) + 2, v_g)
           + case when heures < v_h then v_bonus else 0 end,
         predicteurs_24h, commentaires_24h, pieces_24h, predicteurs_total, commentaires_total, predictions_1h,
         round(momentum, 3), round(variation, 1),
         -- controverse = (1 − |p − 0,5| × 2) × prédicteurs uniques
         round((1 - abs(part_oui - 0.5) * 2) * predicteurs_total, 3),
         now()
    from calc
  on conflict (marche_id) do update set
    score_tendance = excluded.score_tendance, predicteurs_24h = excluded.predicteurs_24h, commentaires_24h = excluded.commentaires_24h,
    pieces_24h = excluded.pieces_24h, predicteurs_total = excluded.predicteurs_total, commentaires_total = excluded.commentaires_total,
    predictions_1h = excluded.predictions_1h, momentum = excluded.momentum, variation_oui_24h = excluded.variation_oui_24h,
    controverse = excluded.controverse, calcule_le = excluded.calcule_le;
  get diagnostics v_nb = row_count;

  -- Les marchés qui ne sont plus en ligne sortent du tableau des scores
  delete from public.scores_marches s
   where not exists (select 1 from public.marches m where m.id = s.marche_id and m.statut = 'approuve' and m.type_reponse = 'oui_non' and m.date_fin > now());
  return v_nb;
end;
$$;

select cron.schedule('kongox-scores-fil', '*/10 * * * *', $$select public.calculer_scores_fil()$$);


-- ---------------------------------------------------------------------
-- 3. Sections de l'accueil
-- ---------------------------------------------------------------------
-- Applique la règle de diversité : dans les N premiers, au plus K marchés de la même catégorie.
-- Les marchés écartés passent après, dans leur ordre. p_ids et p_categories sont dans l'ordre du tri.
create function public.diversifier(p_ids bigint[], p_categories text[], p_taille integer)
returns bigint[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_max   integer := public.reglage_fil('diversite_max')::integer;
  v_top   integer := public.reglage_fil('diversite_top')::integer;
  v_pris  bigint[] := '{}';
  v_mis   bigint[] := '{}';
  v_comptes jsonb := '{}';
  i integer;
  c text;
begin
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    c := p_categories[i];
    if cardinality(v_pris) < v_top and coalesce((v_comptes ->> c)::integer, 0) >= v_max then
      v_mis := v_mis || p_ids[i];   -- trop de cette catégorie dans le haut de la section : plus tard
    else
      v_pris := v_pris || p_ids[i];
      if cardinality(v_pris) <= v_top then
        v_comptes := v_comptes || jsonb_build_object(c, coalesce((v_comptes ->> c)::integer, 0) + 1);
      end if;
    end if;
  end loop;
  return (v_pris || v_mis)[1:p_taille];
end;
$$;

-- Sections publiques (identiques pour tout le monde). « Pour toi » est calculée à part (fil_pour_toi).
-- Ordre sans doublon : Soki du jour, (Pour toi), Tendances, (En forte hausse), Bientôt fermés,
-- (Le Congo est divisé), Nouveaux. p_exclure : marchés déjà montrés plus haut (ex. Pour toi).
create function public.fil_sections(p_exclure bigint[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_taille integer := public.reglage_fil('taille_section')::integer;
  v_vus    bigint[] := coalesce(p_exclure, '{}');
  v_ids    bigint[];
  v_cats   text[];
  v_res    jsonb := '[]';
  v_soki   bigint;
begin
  -- Soki du jour
  if public.reglage_fil('section_soki') = 1 then
    select id into v_soki from public.marches
     where soki_du_jour and statut = 'approuve' and type_reponse = 'oui_non' and date_fin > now() limit 1;
    if v_soki is not null then
      v_res := v_res || jsonb_build_object('cle', 'soki', 'titre', 'Soki du jour', 'marches', jsonb_build_array(v_soki));
      v_vus := v_vus || v_soki;
    end if;
  end if;

  -- Tendances : épinglés (mis en avant) d'abord, puis score de tendance, avec la règle de diversité
  if public.reglage_fil('section_tendances') = 1 then
    select array_agg(m.id order by m.mis_en_avant desc, coalesce(s.score_tendance, 0) desc, m.id desc),
           array_agg(m.categorie order by m.mis_en_avant desc, coalesce(s.score_tendance, 0) desc, m.id desc)
      into v_ids, v_cats
      from public.marches m left join public.scores_marches s on s.marche_id = m.id
     where m.statut = 'approuve' and m.type_reponse = 'oui_non' and m.date_fin > now() and not (m.id = any (v_vus));
    v_ids := public.diversifier(v_ids, v_cats, v_taille);
    if cardinality(v_ids) > 0 then
      v_res := v_res || jsonb_build_object('cle', 'tendances', 'titre', 'Tendances', 'marches', to_jsonb(v_ids));
      v_vus := v_vus || v_ids;
    end if;
  end if;

  -- En forte hausse (phase 2)
  if public.reglage_fil('section_hausse') = 1 then
    select array_agg(m.id order by greatest(s.momentum, abs(s.variation_oui_24h) / 10) desc), array_agg(m.categorie order by greatest(s.momentum, abs(s.variation_oui_24h) / 10) desc)
      into v_ids, v_cats
      from public.marches m join public.scores_marches s on s.marche_id = m.id
     where m.statut = 'approuve' and m.date_fin > now() and not (m.id = any (v_vus))
       and ((s.momentum >= public.reglage_fil('momentum_seuil') and s.predictions_1h >= public.reglage_fil('momentum_min_1h'))
            or abs(s.variation_oui_24h) >= public.reglage_fil('variation_seuil'));
    v_ids := public.diversifier(v_ids, v_cats, v_taille);
    if cardinality(v_ids) > 0 then
      v_res := v_res || jsonb_build_object('cle', 'hausse', 'titre', 'En forte hausse', 'marches', to_jsonb(v_ids));
      v_vus := v_vus || v_ids;
    end if;
  end if;

  -- Bientôt fermés : fermeture dans moins de 24 h, du plus proche au plus lointain
  if public.reglage_fil('section_bientot') = 1 then
    select array_agg(m.id order by m.date_fin), array_agg(m.categorie order by m.date_fin)
      into v_ids, v_cats
      from public.marches m
     where m.statut = 'approuve' and m.type_reponse = 'oui_non' and m.date_fin > now()
       and m.date_fin <= now() + make_interval(hours => public.reglage_fil('bientot_heures')::integer)
       and not (m.id = any (v_vus));
    v_ids := public.diversifier(v_ids, v_cats, v_taille);
    if cardinality(v_ids) > 0 then
      v_res := v_res || jsonb_build_object('cle', 'bientot', 'titre', 'Bientôt fermés', 'marches', to_jsonb(v_ids));
      v_vus := v_vus || v_ids;
    end if;
  end if;

  -- Le Congo est divisé (phase 2)
  if public.reglage_fil('section_divise') = 1 then
    select array_agg(m.id order by s.controverse desc), array_agg(m.categorie order by s.controverse desc)
      into v_ids, v_cats
      from public.marches m join public.scores_marches s on s.marche_id = m.id
     where m.statut = 'approuve' and m.date_fin > now() and not (m.id = any (v_vus))
       and s.predicteurs_total >= public.reglage_fil('controverse_min');
    v_ids := public.diversifier(v_ids, v_cats, v_taille);
    if cardinality(v_ids) > 0 then
      v_res := v_res || jsonb_build_object('cle', 'divise', 'titre', 'Le Congo est divisé', 'marches', to_jsonb(v_ids));
      v_vus := v_vus || v_ids;
    end if;
  end if;

  -- Nouveaux : du plus récent au plus ancien
  if public.reglage_fil('section_nouveaux') = 1 then
    select array_agg(m.id order by coalesce(m.date_publication, m.examine_le, m.cree_le) desc),
           array_agg(m.categorie order by coalesce(m.date_publication, m.examine_le, m.cree_le) desc)
      into v_ids, v_cats
      from public.marches m
     where m.statut = 'approuve' and m.type_reponse = 'oui_non' and m.date_fin > now() and not (m.id = any (v_vus));
    v_ids := public.diversifier(v_ids, v_cats, v_taille);
    if cardinality(v_ids) > 0 then
      v_res := v_res || jsonb_build_object('cle', 'nouveaux', 'titre', 'Nouveaux', 'marches', to_jsonb(v_ids));
    end if;
  end if;

  return v_res;
end;
$$;

-- « Pour toi » (phase 2) : catégories où je prédis le plus, mes communautés, les pronostiqueurs que je suis ;
-- triés par score de tendance. Vide si la section est désactivée ou sans connexion.
-- p_exclure : marchés déjà dans les sections publiques (ces sections restent ainsi en cache pour tout le monde).
create function public.fil_pour_toi(p_exclure bigint[] default '{}')
returns bigint[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id   uuid := auth.uid();
  v_ids  bigint[];
  v_cats text[];
begin
  if v_id is null or public.reglage_fil('section_pour_toi') = 0 then
    return '{}';
  end if;
  with mes_categories as (
    select m.categorie, count(*) as n from public.predictions p join public.marches m on m.id = p.marche_id
     where p.utilisateur_id = v_id group by m.categorie order by n desc limit 2
  ),
  candidats as (
    select m.id, m.categorie, coalesce(s.score_tendance, 0) as score
      from public.marches m left join public.scores_marches s on s.marche_id = m.id
     where m.statut = 'approuve' and m.type_reponse = 'oui_non' and m.date_fin > now()
       and not (m.id = any (coalesce(p_exclure, '{}')))
       and not exists (select 1 from public.predictions p where p.marche_id = m.id and p.utilisateur_id = v_id)
       and (m.categorie in (select categorie from mes_categories)
            or m.communaute_id in (select communaute_id from public.membres_communaute where utilisateur_id = v_id)
            or exists (select 1 from public.predictions p join public.abonnements a on a.suivi_id = p.utilisateur_id
                        where a.suiveur_id = v_id and p.marche_id = m.id))
  )
  select array_agg(id order by score desc, id desc), array_agg(categorie order by score desc, id desc) into v_ids, v_cats from candidats;
  return public.diversifier(v_ids, v_cats, public.reglage_fil('taille_section')::integer);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Page /marches : recherche, filtres, tris, pagination
-- ---------------------------------------------------------------------
-- Recherche insensible aux accents (« leopards » trouve « Léopards »)
create function public.sans_accents(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(p, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
                      'aaaaaaceeeeiiiinooooouuuuyyoaAAAAAACEEEEIIIINOOOOOUUUUY');
$$;


-- p_statut : en_ligne (défaut), bientot, fermes, regles, tous
-- p_tri : tendance (défaut), nouveaux, bientot, plus_mises, plus_commentes
create function public.rechercher_marches(p_recherche text, p_categorie text, p_statut text, p_communaute bigint,
                                          p_tri text, p_decalage integer, p_limite integer)
returns table (id bigint, question text, categorie text, statut text, date_fin timestamptz, sponsor text,
               mis_en_avant boolean, volume bigint, oui bigint, score numeric, commentaires integer, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select m.id, m.question, m.categorie, m.statut, m.date_fin, m.sponsor, m.mis_en_avant,
           coalesce(m.date_publication, m.examine_le, m.cree_le) as publie_le,
           coalesce((select sum(total_mise) from public.options_marche o where o.marche_id = m.id), 0)::bigint as volume,
           coalesce((select total_mise from public.options_marche o where o.marche_id = m.id and o.ordre = 0), 0)::bigint as oui,
           coalesce(s.score_tendance, 0) as score,
           coalesce(s.commentaires_total, public.commentaires_marche(m.id, '-infinity')) as commentaires
      from public.marches m
      left join public.scores_marches s on s.marche_id = m.id
     where m.type_reponse = 'oui_non'
       and case coalesce(nullif(p_statut, ''), 'en_ligne')
             when 'en_ligne' then m.statut = 'approuve' and m.date_fin > now()
             when 'bientot'  then m.statut = 'approuve' and m.date_fin > now() and m.date_fin <= now() + interval '24 hours'
             when 'fermes'   then m.statut = 'ferme' or (m.statut = 'approuve' and m.date_fin <= now())
             when 'regles'   then m.statut = 'regle'
             else m.statut in ('approuve', 'ferme', 'regle') end
       and (coalesce(p_categorie, '') = '' or m.categorie = p_categorie)
       and (p_communaute is null or m.communaute_id = p_communaute)
       and (coalesce(btrim(p_recherche), '') = ''
            or public.sans_accents(lower(m.question)) like '%' || replace(replace(replace(public.sans_accents(lower(btrim(p_recherche))), '\', '\'), '%', '\%'), '_', '\_') || '%')
  )
  select id, question, categorie, statut, date_fin, sponsor, mis_en_avant, volume, oui, score, commentaires, count(*) over ()
    from base
   order by
     case when coalesce(p_tri, 'tendance') = 'tendance' then mis_en_avant end desc,
     case coalesce(p_tri, 'tendance')
       when 'nouveaux' then -extract(epoch from publie_le)
       when 'bientot' then extract(epoch from date_fin)
       when 'plus_mises' then -volume
       when 'plus_commentes' then -commentaires
       else -score end,
     case when p_tri = 'plus_commentes' then -score end,
     id desc
   offset greatest(coalesce(p_decalage, 0), 0)
   limit least(greatest(coalesce(p_limite, 12), 1), 48);
$$;

-- ---------------------------------------------------------------------
-- 5. Mesure : événements du fil
-- ---------------------------------------------------------------------
-- Visiteur anonyme : identifiant aléatoire créé dans le navigateur (aucune donnée personnelle).
-- Visite : identifiant aléatoire par onglet (sessionStorage).
create table public.evenements_fil (
  id             bigint generated always as identity primary key,
  cree_le        timestamptz not null default now(),
  type           text     not null,
  marche_id      bigint   references public.marches (id) on delete cascade,
  section        text,
  position       smallint,
  page           text,
  utilisateur_id uuid     references public.utilisateurs (id) on delete set null,
  visiteur_id    uuid     not null,
  visite_id      uuid     not null,
  constraint evenements_type_valide check (type in ('affiche', 'clic', 'prediction', 'visite')),
  constraint evenements_section_valide check (section is null or section ~ '^[a-z_]{2,20}$'),
  constraint evenements_page_valide check (page is null or char_length(page) <= 40)
);
create index evenements_fil_date on public.evenements_fil (cree_le desc);
create index evenements_fil_section on public.evenements_fil (section, type, cree_le);
create index evenements_fil_visiteur on public.evenements_fil (visiteur_id, cree_le);

-- Enregistre un lot d'événements (appelée par le serveur, clé service role)
-- p : [{type, marche_id, section, position, page, visiteur_id, visite_id}], 50 au maximum
create function public.enregistrer_evenements_fil(p_evenements jsonb, p_utilisateur uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nb integer;
begin
  insert into public.evenements_fil (type, marche_id, section, position, page, utilisateur_id, visiteur_id, visite_id)
  select e ->> 'type',
         case when (e ->> 'marche_id') ~ '^[0-9]{1,12}$' and exists (select 1 from public.marches where id = (e ->> 'marche_id')::bigint)
              then (e ->> 'marche_id')::bigint end,
         nullif(e ->> 'section', ''),
         case when (e ->> 'position') ~ '^[0-9]{1,3}$' then (e ->> 'position')::smallint end,
         left(nullif(e ->> 'page', ''), 40),
         p_utilisateur,
         (e ->> 'visiteur_id')::uuid,
         (e ->> 'visite_id')::uuid
    from jsonb_array_elements(p_evenements) e
   where e ->> 'type' in ('affiche', 'clic', 'prediction', 'visite')
     and (e ->> 'visiteur_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (e ->> 'visite_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (e ->> 'section' is null or e ->> 'section' ~ '^[a-z_]{2,20}$')
   limit 50;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

-- Les événements de plus de 180 jours sont effacés (une fois par jour)
select cron.schedule('kongox-purge-evenements', '30 3 * * *', $$delete from public.evenements_fil where cree_le < now() - interval '180 days'$$);

-- Indicateurs (Admin › Tableau de bord), sur les p_jours derniers jours
create function public.indicateurs_fil(p_jours integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz := now() - make_interval(days => greatest(coalesce(p_jours, 7), 1));
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    -- Taux de clic par section = clics ÷ affichages
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('section', section, 'affichages', affichages, 'clics', clics,
                   'predictions', predictions, 'taux_clic', case when affichages = 0 then 0 else round(100.0 * clics / affichages, 1) end) order by affichages desc), '[]')
                   from (select section,
                                count(*) filter (where type = 'affiche') as affichages,
                                count(*) filter (where type = 'clic') as clics,
                                count(*) filter (where type = 'prediction') as predictions
                           from public.evenements_fil where cree_le >= v_debut and section is not null group by section) x),
    -- Prédictions par visite
    'visites', (select count(distinct visite_id) from public.evenements_fil where cree_le >= v_debut),
    'predictions', (select count(*) from public.evenements_fil where cree_le >= v_debut and type = 'prediction'),
    -- Retour J1 / J7 : part des visiteurs revenus le lendemain / 7 jours après leur premier jour
    'retour', (with premiers as (
                 select visiteur_id, min((cree_le at time zone 'Africa/Kinshasa')::date) as j0 from public.evenements_fil group by visiteur_id
               ), jours as (
                 select distinct visiteur_id, (cree_le at time zone 'Africa/Kinshasa')::date as j from public.evenements_fil
               )
               select jsonb_build_object(
                 'j1_base', count(*) filter (where p.j0 >= (v_debut at time zone 'Africa/Kinshasa')::date and p.j0 <= (now() at time zone 'Africa/Kinshasa')::date - 1),
                 'j1', count(*) filter (where p.j0 >= (v_debut at time zone 'Africa/Kinshasa')::date and p.j0 <= (now() at time zone 'Africa/Kinshasa')::date - 1
                                         and exists (select 1 from jours j where j.visiteur_id = p.visiteur_id and j.j = p.j0 + 1)),
                 'j7_base', count(*) filter (where p.j0 >= (v_debut at time zone 'Africa/Kinshasa')::date - 7 and p.j0 <= (now() at time zone 'Africa/Kinshasa')::date - 7),
                 'j7', count(*) filter (where p.j0 >= (v_debut at time zone 'Africa/Kinshasa')::date - 7 and p.j0 <= (now() at time zone 'Africa/Kinshasa')::date - 7
                                         and exists (select 1 from jours j where j.visiteur_id = p.visiteur_id and j.j = p.j0 + 7)))
                 from premiers p),
    -- Temps avant la première prédiction (médiane, en minutes) pour les inscrits de la période
    'minutes_premiere_prediction', (select round(percentile_cont(0.5) within group (order by extract(epoch from premiere - u.cree_le) / 60)::numeric, 1)
                                      from public.utilisateurs u
                                      join lateral (select min(cree_le) as premiere from public.predictions p where p.utilisateur_id = u.id) x on true
                                     where u.cree_le >= v_debut and x.premiere is not null)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Droits et Row Level Security
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['public.calculer_scores_fil()', 'public.enregistrer_evenements_fil(jsonb, uuid)', 'public.commentaires_marche(bigint, timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.reglage_fil(text)', 'public.fil_sections(bigint[])', 'public.diversifier(bigint[], text[], integer)',
                           'public.rechercher_marches(text, text, text, bigint, text, integer, integer)', 'public.sans_accents(text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  foreach f in array array['public.fil_pour_toi(bigint[])', 'public.modifier_reglage_fil(text, numeric)', 'public.indicateurs_fil(integer)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

alter table public.reglages_fil   enable row level security;
alter table public.scores_marches enable row level security;
alter table public.evenements_fil enable row level security;
revoke all on table public.reglages_fil, public.scores_marches, public.evenements_fil from anon, authenticated;

grant select on table public.reglages_fil to anon, authenticated;
create policy "Réglages du fil publics" on public.reglages_fil for select to anon, authenticated using (true);
grant select on table public.scores_marches to anon, authenticated;
create policy "Scores publics" on public.scores_marches for select to anon, authenticated using (true);
grant select on table public.evenements_fil to authenticated;
create policy "Événements réservés aux admins" on public.evenements_fil for select to authenticated using ((select public.est_admin()));

-- Premier calcul
select public.calculer_scores_fil();
