"""Lance les suites de tests de KongoX, une par une, avec un nettoyage de la base avant chacune.

Prérequis (voir tests/README.md) :
  - .env.local rempli (Supabase, clé service role) ;
  - la variable d'environnement KX_DB_URL (connexion PostgreSQL directe à la base Supabase) ;
  - pour les pages : `npm run build` fait avant (le serveur est lancé sur le port 3123 s'il ne tourne pas).

Exemples :
  python tests/lancer.py               # code + base de données (SQL / REST)
  python tests/lancer.py --pages       # + pages (serveur de production sur le port 3123)
  python tests/lancer.py --seul chat   # seulement les suites dont le nom contient « chat »
  python tests/lancer.py --ia          # + l'assistant IA (vrais appels à l'API Claude : payant)

ATTENTION : les tests créent des comptes « Test_… » et des marchés « Test KongoX… » dans la base,
puis les suppriment. À lancer sur la base de développement, jamais sur la base de production.
"""
import argparse
import os
import subprocess
import sys
import time
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
PROJET = os.path.dirname(ICI)
ENV = os.path.join(PROJET, '.env.local')
OUTILS = os.path.join(ICI, 'outils')
SITE = 'http://localhost:3123'

# Ordre : du plus ancien au plus récent (chaque suite crée ses propres données)
CODE = ['code/test_requetes_predictions.py']
SQL = ['sql/test_etape1.py', 'sql/test_etape2.py', 'sql/test_etape3.py', 'sql/test_backoffice.py', 'sql/test_etape4.py',
       'sql/test_fil.py', 'sql/test_chat.py', 'sql/test_realtime.py', 'sql/test_partage.py', 'sql/test_communaute.py']
IA = ['sql/test_ia.py']
PAGES = ['pages/test_pages2.py', 'pages/test_pages3.py', 'pages/test_pages4.py', 'pages/test_pages_bo.py', 'pages/test_pages_fil.py',
         'pages/test_pages_chat.py', 'pages/test_pages_partage.py', 'pages/test_pages_communaute.py', 'pages/test_pages_mes_predictions.py']


def nettoyer():
    r = subprocess.run(['node', os.path.join(OUTILS, 'sql.cjs'), os.path.join(OUTILS, 'nettoyage.sql')], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        print('  (nettoyage : ' + (r.stderr.strip() or r.stdout.strip())[:200] + ')')


def site_pret():
    try:
        urllib.request.urlopen(SITE + '/', timeout=5)
        return True
    except Exception:
        return False


def lancer(fichier, detail):
    debut = time.time()
    r = subprocess.run([sys.executable, os.path.join(ICI, fichier), ENV, OUTILS, PROJET], capture_output=True, text=True, encoding='utf-8',
                       env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}, timeout=1200)
    sortie = r.stdout + r.stderr
    lignes = sortie.splitlines()
    ok_n = sum(1 for l in lignes if l.startswith('OK '))
    echecs = [l for l in lignes if l.startswith('ECHEC')]
    fin = [l for l in lignes if l.startswith(('RÉSULTAT', 'RESULTAT'))]
    vert = r.returncode == 0 and not echecs and fin and ('TOUT EST BON' in fin[-1].upper())
    print(f"{'VERT ' if vert else 'ROUGE'}  {fichier:<42} {ok_n:>3} vérifications  {time.time() - debut:5.0f} s")
    if not vert:
        for l in (echecs or lignes[-15:]):
            print('       ' + l[:220])
    elif detail:
        print('\n'.join('       ' + l for l in lignes))
    return vert, ok_n


def main():
    p = argparse.ArgumentParser(description='Tests KongoX')
    p.add_argument('--pages', action='store_true', help='lancer aussi les tests des pages (serveur sur le port 3123)')
    p.add_argument('--ia', action='store_true', help="lancer aussi le test de l'assistant IA (payant)")
    p.add_argument('--seul', help='seulement les suites dont le nom contient ce texte')
    p.add_argument('--detail', action='store_true', help='afficher toutes les vérifications')
    a = p.parse_args()

    if not os.path.exists(ENV):
        sys.exit('.env.local introuvable à la racine du projet.')
    if not os.environ.get('KX_DB_URL'):
        sys.exit("Variable KX_DB_URL manquante (connexion PostgreSQL directe, voir tests/README.md).")

    suites = CODE + SQL + (IA if a.ia else []) + (PAGES if a.pages else [])
    if a.seul:
        suites = [s for s in suites if a.seul in s]

    serveur = None
    if any(s.startswith('pages/') for s in suites) and not site_pret():
        print('Démarrage du serveur de production sur le port 3123 (npm run build doit avoir été fait)…')
        serveur = subprocess.Popen('npx next start -p 3123', cwd=PROJET, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            if site_pret():
                break
            time.sleep(1)
        else:
            sys.exit('Le serveur ne répond pas sur le port 3123.')

    resultats = []
    try:
        for s in suites:
            if not s.startswith('code/'):
                nettoyer()
            resultats.append((s, *lancer(s, a.detail)))
    finally:
        nettoyer()
        if serveur:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/T', '/F', '/PID', str(serveur.pid)], capture_output=True)
            else:
                serveur.terminate()

    rouges = [s for s, vert, _ in resultats if not vert]
    total = sum(n for _, _, n in resultats)
    print(f"\n{len(resultats) - len(rouges)}/{len(resultats)} suites au vert, {total} vérifications.")
    if rouges:
        print('Suites en échec : ' + ', '.join(rouges))
    sys.exit(1 if rouges else 0)


if __name__ == '__main__':
    main()
