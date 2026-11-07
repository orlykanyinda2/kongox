"""Garde-fou : aucune requête « mes prédictions » ne doit renvoyer les mises des autres.

Depuis feat/communaute, la table `predictions` est publique (« Qui a voté »). La Row Level Security
ne filtre donc plus sur la personne connectée : chaque requête sur `predictions` dans le code de
l'application doit filtrer elle-même sur `utilisateur_id`.

Une requête qui lit volontairement toutes les prédictions (admin, statistiques) doit être précédée
du commentaire `// toutes-les-predictions : <raison>` dans les 3 lignes au-dessus.

Usage : python tests/code/test_requetes_predictions.py  (aucune base de données nécessaire)
"""
import os
import re
import sys

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src')
ok = True
vues = 0

for dossier, _, fichiers in os.walk(RACINE):
    for f in fichiers:
        if not f.endswith(('.ts', '.tsx')):
            continue
        chemin = os.path.join(dossier, f)
        texte = open(chemin, encoding='utf-8').read()
        lignes = texte.split('\n')
        for m in re.finditer(r'\.from\(\s*["\']predictions["\']\s*\)', texte):
            vues += 1
            no = texte.count('\n', 0, m.start())
            # La requête : jusqu'à la fin de l'instruction (point-virgule ou ligne vide)
            suite = texte[m.end():]
            fin = min([i for i in (suite.find(';'), suite.find('\n\n')) if i >= 0] or [len(suite)])
            chaine = suite[:fin]
            au_dessus = '\n'.join(lignes[max(0, no - 3):no + 1])
            relatif = os.path.relpath(chemin, os.path.join(RACINE, '..'))
            if 'utilisateur_id' in chaine:
                print(f'OK    {relatif}:{no + 1} filtre sur utilisateur_id')
            elif 'toutes-les-predictions' in au_dessus:
                print(f'OK    {relatif}:{no + 1} toutes les prédictions, volontaire (commentaire)')
            else:
                ok = False
                print(f'ECHEC {relatif}:{no + 1} requête sur predictions sans filtre utilisateur_id ni commentaire « toutes-les-predictions »')

if vues == 0:
    ok = False
    print('ECHEC aucune requête trouvée : le dossier src a-t-il changé ?')
print(f'\n{vues} requête(s) sur predictions vérifiée(s)')
print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
sys.exit(0 if ok else 1)
