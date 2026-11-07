-- =====================================================================
-- KongoX — Étape 5 (première partie) : assistant IA (API Claude)
-- =====================================================================
-- Limites anti-abus : un nombre de questions par personne et par jour, plus
-- un plafond global par jour (jour de Kinshasa). La question est comptée
-- AVANT l'appel à l'API et rendue si l'appel échoue.
-- Consommation (requêtes, jetons) enregistrée par le serveur seulement.
-- Les messages ne sont PAS conservés dans la base.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------
insert into public.reglages (cle, libelle, valeur, minimum, maximum) values
  ('ia_active',              'Assistant IA activé (1 = oui, 0 = non)',   1,    0, 1),
  ('ia_questions_par_jour',  'Questions à l''assistant par personne et par jour', 20, 1, 500),
  ('ia_plafond_global_jour', 'Questions à l''assistant par jour (toutes personnes)', 2000, 1, 1000000);

insert into public.reglages (cle, libelle, texte) values
  ('ia_modele', 'Modèle de l''assistant IA (API Claude)', 'claude-haiku-5-5');

-- Le nom du modèle est vérifié (lettres minuscules, chiffres, tirets, commence par « claude- »)
create or replace function public.modifier_reglage(p_cle text, p_valeur bigint, p_texte text default null)
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
    if p_cle = 'whatsapp_equipe' and btrim(coalesce(p_texte, '')) !~ '^[0-9]{0,15}$' then
      raise exception 'Numéro invalide.' using hint = 'hors_limites';
    end if;
    if p_cle = 'ia_modele' and btrim(coalesce(p_texte, '')) !~ '^claude-[a-z0-9-]{2,60}$' then
      raise exception 'Nom de modèle invalide.' using hint = 'hors_limites';
    end if;
    update public.reglages set texte = btrim(coalesce(p_texte, '')), modifie_par = auth.uid(), modifie_le = now() where cle = p_cle;
  end if;
  perform public.journaliser_detail('reglage_modifie', null, null,
    jsonb_build_object('cle', p_cle, 'valeur', coalesce(r.valeur::text, r.texte)),
    jsonb_build_object('cle', p_cle, 'valeur', coalesce(p_valeur::text, btrim(coalesce(p_texte, '')))));
end;
$$;

-- Lecture d'un réglage texte
create function public.reglage_texte(p_cle text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select texte from public.reglages where cle = p_cle;
$$;


-- ---------------------------------------------------------------------
-- 2. Compteurs
-- ---------------------------------------------------------------------
-- Questions posées par une personne un jour donné
create table public.ia_questions (
  jour           date    not null,
  utilisateur_id uuid    not null references public.utilisateurs (id) on delete cascade,
  nombre         integer not null default 0,
  primary key (jour, utilisateur_id),
  constraint ia_questions_positif check (nombre >= 0)
);

-- Consommation de l'API par jour
create table public.ia_usage_jour (
  jour                date   primary key,
  questions           integer not null default 0,   -- questions acceptées (comptées pour le plafond global)
  requetes            integer not null default 0,   -- appels réussis à l'API
  erreurs             integer not null default 0,   -- appels échoués (question rendue)
  jetons_entree       bigint  not null default 0,
  jetons_sortie       bigint  not null default 0,
  jetons_cache_lus    bigint  not null default 0,
  jetons_cache_ecrits bigint  not null default 0
);

-- Réserve une question : limite par personne et plafond global, en une seule fois.
-- Renvoie le nombre de questions restantes aujourd'hui pour cette personne.
create function public.reserver_question_ia()
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

-- Rend une question si l'appel à l'API a échoué (personne ne perd une question à cause d'une panne)
create function public.rendre_question_ia()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Africa/Kinshasa')::date;
begin
  if auth.uid() is null then
    return;
  end if;
  update public.ia_questions set nombre = greatest(nombre - 1, 0) where jour = v_jour and utilisateur_id = auth.uid();
  update public.ia_usage_jour set questions = greatest(questions - 1, 0), erreurs = erreurs + 1 where jour = v_jour;
end;
$$;

-- Questions restantes aujourd'hui pour l'utilisateur connecté
create function public.questions_ia_restantes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(public.reglage('ia_questions_par_jour')::integer - coalesce((
    select nombre from public.ia_questions
     where jour = (now() at time zone 'Africa/Kinshasa')::date and utilisateur_id = auth.uid()), 0), 0);
$$;

-- Enregistre la consommation d'un appel réussi (côté serveur, clé service role)
create function public.enregistrer_usage_ia(p_entree bigint, p_sortie bigint, p_cache_lus bigint, p_cache_ecrits bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ia_usage_jour (jour, requetes, jetons_entree, jetons_sortie, jetons_cache_lus, jetons_cache_ecrits)
  values ((now() at time zone 'Africa/Kinshasa')::date, 1, coalesce(p_entree, 0), coalesce(p_sortie, 0), coalesce(p_cache_lus, 0), coalesce(p_cache_ecrits, 0))
  on conflict (jour) do update set
    requetes = public.ia_usage_jour.requetes + 1,
    jetons_entree = public.ia_usage_jour.jetons_entree + excluded.jetons_entree,
    jetons_sortie = public.ia_usage_jour.jetons_sortie + excluded.jetons_sortie,
    jetons_cache_lus = public.ia_usage_jour.jetons_cache_lus + excluded.jetons_cache_lus,
    jetons_cache_ecrits = public.ia_usage_jour.jetons_cache_ecrits + excluded.jetons_cache_ecrits;
$$;

-- Forme récente d'une équipe (5 derniers matchs terminés connus), pour le contexte de l'assistant
create function public.forme_equipe(p_equipe bigint, p_limite integer default 5)
returns table (date_match timestamptz, adversaire text, domicile boolean, buts_pour integer, buts_contre integer, resultat text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.date_match,
         case when m.equipe_dom_id = p_equipe then e.nom else d.nom end,
         m.equipe_dom_id = p_equipe,
         case when m.equipe_dom_id = p_equipe then m.buts_dom else m.buts_ext end,
         case when m.equipe_dom_id = p_equipe then m.buts_ext else m.buts_dom end,
         case when m.buts_dom = m.buts_ext then 'N'
              when (m.equipe_dom_id = p_equipe) = (m.buts_dom > m.buts_ext) then 'V' else 'D' end
    from public.matchs m
    join public.equipes d on d.id = m.equipe_dom_id
    join public.equipes e on e.id = m.equipe_ext_id
   where m.statut = 'termine' and (m.equipe_dom_id = p_equipe or m.equipe_ext_id = p_equipe)
   order by m.date_match desc
   limit least(greatest(coalesce(p_limite, 5), 1), 10);
$$;


-- ---------------------------------------------------------------------
-- 3. Droits
-- ---------------------------------------------------------------------
revoke execute on function public.enregistrer_usage_ia(bigint, bigint, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.reglage_texte(text) from public;
grant execute on function public.reglage_texte(text) to anon, authenticated;
revoke execute on function public.forme_equipe(bigint, integer) from public;
grant execute on function public.forme_equipe(bigint, integer) to anon, authenticated;
do $$
declare
  f text;
begin
  foreach f in array array['public.reserver_question_ia()', 'public.rendre_question_ia()', 'public.questions_ia_restantes()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
alter table public.ia_questions  enable row level security;
alter table public.ia_usage_jour enable row level security;
revoke all on table public.ia_questions, public.ia_usage_jour from anon, authenticated;

grant select on table public.ia_questions to authenticated;
create policy "Mon compteur de questions, ou tous pour les admins" on public.ia_questions for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

grant select on table public.ia_usage_jour to authenticated;
create policy "Consommation réservée aux admins" on public.ia_usage_jour for select to authenticated
  using ((select public.est_admin()));
