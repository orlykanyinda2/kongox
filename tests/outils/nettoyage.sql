begin;
update public.options_marche o set total_mise = total_mise - coalesce((select sum(p.montant) from public.predictions p join public.utilisateurs u on u.id = p.utilisateur_id where p.option_id = o.id and u.nom_utilisateur like 'Test\_%' and p.statut = 'en_cours'), 0);
delete from public.journal_admin where auteur_id in (select id from public.utilisateurs where nom_utilisateur like 'Test\_%');
delete from auth.users where id in (select id from public.utilisateurs where nom_utilisateur like 'Test\_%');
-- invités fermés par les tests (pseudo remplacé par invite_…)
update public.options_marche o set total_mise = total_mise - coalesce((select sum(p.montant) from public.predictions p join auth.users a on a.id = p.utilisateur_id where p.option_id = o.id and a.email like 'ferme-%@invite.kongox.local' and p.statut = 'en_cours'), 0);
delete from auth.users where email like 'ferme-%@invite.kongox.local';
update public.marches set option_gagnante_id = null where question like 'Test KongoX%';
delete from public.decisions_curateur where marche_id in (select id from public.marches where question like 'Test KongoX%');
delete from public.journal_admin where cible_marche in (select id from public.marches where question like 'Test KongoX%');
delete from public.options_marche where marche_id in (select id from public.marches where question like 'Test KongoX%');
delete from public.marches where question like 'Test KongoX%';
update public.marches set soki_du_jour = (question = 'Les Léopards vont-ils se qualifier pour la CAN 2027 ?');
delete from public.evenements_fil where visiteur_id::text like 'eeeeeeee-%';
commit;
select (select count(*) from public.utilisateurs where nom_utilisateur like 'Test\_%') as comptes, (select count(*) from public.marches) as marches, (select sum(total_mise) from public.options_marche) as cagnottes, (select count(*) from public.predictions) as predictions, (select count(*) from public.journal_admin) as journal;
