-- =====================================================================
-- KongoX — Marchés d'exemple pour le développement (données fictives)
-- =====================================================================
-- À exécuter après les migrations. Peut être relancé : une question déjà
-- présente n'est pas recréée. Les cagnottes partent de zéro (50 % / 50 %) :
-- aucune pièce n'est inventée, les pourcentages bougent avec les vraies mises.

with exemples (question, categorie, fin, source, soki) as (
  values
    ('Les Léopards vont-ils se qualifier pour la CAN 2027 ?', 'football', interval '6 days', 'Site officiel de la CAF', true),
    ('TP Mazembe gagnera-t-il le championnat Linafoot cette saison ?', 'football', interval '3 months', 'Classement officiel de la Linafoot', false),
    ('Un joueur congolais marquera-t-il en Ligue des champions ce mois-ci ?', 'football', interval '24 days', 'Site officiel de l''UEFA', false),
    ('Fally Ipupa sortira-t-il un nouvel album avant juin 2027 ?', 'musique', interval '7 months', 'Annonce officielle de l''artiste', false),
    ('Le prochain clip de Ferre Gola dépassera-t-il 5 millions de vues en 30 jours ?', 'musique', interval '30 days', 'Compteur YouTube officiel', false),
    ('Le gouvernement annoncera-t-il une baisse du prix du carburant avant mars ?', 'politique', interval '4 months', 'Communiqué officiel du gouvernement', false),
    ('Le Parlement votera-t-il le budget 2027 avant le 31 décembre ?', 'politique', interval '55 days', 'Journal officiel', false),
    ('Le dollar dépassera-t-il 3 000 FC au marché avant février ?', 'vie_quotidienne', interval '3 months', 'Taux affiché par les cambistes + médias locaux', false),
    ('Le pain de 500 FC passera-t-il à 1 000 FC à Kinshasa avant la fin de l''année ?', 'vie_quotidienne', interval '55 days', 'Constat des membres + médias locaux', false),
    ('Y aura-t-il plus de 3 coupures de courant à Limete cette semaine ?', 'vie_quotidienne', interval '4 days', 'Communiqués de la SNEL + constat des membres', false)
),
nouveaux as (
  insert into public.marches (question, categorie, date_fin, source, statut, soki_du_jour, examine_le)
  select e.question, e.categorie, now() + e.fin, e.source, 'approuve', e.soki, now()
    from exemples e
   where not exists (select 1 from public.marches m where m.question = e.question)
  returning id
)
insert into public.options_marche (marche_id, libelle, ordre)
select id, libelle, ordre
  from nouveaux
 cross join (values ('OUI', 0), ('NON', 1)) as o (libelle, ordre);
