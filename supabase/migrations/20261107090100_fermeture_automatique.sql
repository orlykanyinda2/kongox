-- =====================================================================
-- KongoX — Fermeture automatique des marchés échus (toutes les 5 minutes)
-- =====================================================================
-- Fichier séparé : si pg_cron n'est pas disponible, le reste de l'étape 2 marche
-- quand même (on ne peut de toute façon plus miser après la date de fin).

create extension if not exists pg_cron;

select cron.schedule(
  'kongox-fermer-marches-echus',
  '*/5 * * * *',
  $$select public.fermer_marches_echus()$$
);
