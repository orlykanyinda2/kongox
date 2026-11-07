import sys, os, subprocess
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'commun_sql.py'), encoding='utf-8').read())
PROJET = sys.argv[3]
try:
    u = creer('RT')
    m = marche('le direct fonctionne-t-il ?', 'musique', 1)
    sql("update public.reglages set valeur = 0 where cle = 'chat_intervalle_secondes'")
    email = u['nom'].lower() + '@kongox.local'
    # mot de passe : recréé pour le script
    req('PUT', f"/auth/v1/admin/users/{u['id']}", S, None, {'password': 'Mdp!RealTime42'})
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_realtime.cjs'), sys.argv[1], PROJET, str(m), email, 'Mdp!RealTime42'],
                       capture_output=True, text=True, encoding='utf-8', timeout=60)
    print(r.stdout.strip(), r.stderr.strip())
    verifier('Realtime de bout en bout', r.returncode == 0, r.stderr)
finally:
    sql("update public.reglages set valeur = 5 where cle = 'chat_intervalle_secondes'")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))
print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
