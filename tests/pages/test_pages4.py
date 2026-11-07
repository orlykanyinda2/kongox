import json, sys, random, base64, subprocess, os, re, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
PG = sys.argv[2]
REF = U.split('//')[1].split('.')[0]
SITE = 'http://localhost:3123'


def req(methode, url, entetes, corps=None):
    r = urllib.request.Request(url, method=methode, headers=entetes, data=json.dumps(corps).encode() if corps is not None else None)
    try:
        with urllib.request.urlopen(r) as rep:
            return rep.status, rep.read().decode('utf-8-sig')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def sql(requete):
    r = subprocess.run(['node', os.path.join(PG, 'sql.cjs'), '-e', requete], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr)
    lignes = [l for l in r.stdout.splitlines() if l.startswith('[')]
    return json.loads(lignes[-1]) if lignes else []


ok = True


def verifier(nom, cond, detail=''):
    global ok
    ok = ok and bool(cond)
    print(('OK    ' if cond else 'ECHEC ') + nom + (('  -> ' + str(detail)[:200]) if not cond else ''))


comptes = {}


def creer(etiquette):
    nom = 'Test_%s_%d' % (etiquette, random.randint(1000, 9999))
    mdp = 'Mdp!%d' % random.randint(100000, 999999)
    hs = {'apikey': S, 'Content-Type': 'application/json'}
    s, d = req('POST', U + '/auth/v1/admin/users', hs, {'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
    uid = json.loads(d)['id']
    s, d = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': nom.lower() + '@kongox.local', 'password': mdp})
    session = json.loads(d)
    valeur = 'base64-' + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip('=')
    nomc = f'sb-{REF}-auth-token'
    morceaux = [valeur[i:i + 3180] for i in range(0, len(valeur), 3180)]
    cookie = f'{nomc}={valeur}' if len(morceaux) == 1 else '; '.join(f'{nomc}.{i}={m}' for i, m in enumerate(morceaux))
    comptes[etiquette] = {'id': uid, 'nom': nom, 'jeton': session['access_token'], 'cookie': cookie}
    return comptes[etiquette]


def page(chemin, c=None):
    return req('GET', SITE + chemin, {'Cookie': c['cookie']} if c else {})


def visible(h, texte):
    # Texte présent dans le HTML rendu (et pas seulement dans les données envoyées au navigateur)
    return f'>{texte}<' in h or f'> {texte}<' in h or texte in re.sub(r'<!-- -->', '', h)


try:
    adm, u1 = creer('Adm'), creer('U1')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    m = sql("select m.marche_id, d.nom as dom, e.nom as ext, l.nom as ligue from public.matchs m join public.equipes d on d.id = m.equipe_dom_id join public.equipes e on e.id = m.equipe_ext_id join public.ligues l on l.id = m.ligue_id where m.statut = 'a_venir' and m.date_match > now() + interval '1 hour' order by m.date_match limit 1")[0]

    s, h = page('/football')
    verifier('/football : puces des championnats + matchs à venir', s == 200 and 'Premier League' in h and 'Linafoot' in h and m['dom'] in h and '1 · ' in h, s)
    s, h = page('/')
    verifier('accueil : « Matchs à venir » et « Classement de la semaine »', 'Matchs à venir' in h and 'Classement de la semaine' in h and 'Tous les matchs' in h)
    verifier('accueil : les marchés de matchs ne sont pas dans les sections du fil', ': qui gagne ?' not in h.split('Marchés en direct')[1].split('Matchs à venir')[0] if 'Marchés en direct' in h else False)

    s, h = page(f"/marches/{m['marche_id']}?choix=2", u1)
    verifier('page d\'un match : titre « Équipe – Équipe » + 3 choix', s == 200 and f"{m['dom']} – {m['ext']}" in h and f"1 · {m['dom']}" in h and 'N · Nul' in h and f"2 · {m['ext']}" in h, s)
    verifier('page d\'un match : répartition 1 N 2 (pas de graphique OUI)', 'aria-label="Répartition des prédictions"' in h and 'aria-label="Évolution du pourcentage"' not in h)

    s, h = page('/classement')
    verifier('/classement : titre, périodes, communauté contre communauté', 'de mayele ?' in h and 'Cette semaine' in h and 'Depuis le début' in h and 'Communauté contre communauté' in h, s)
    s, h = page('/classement?periode=mois&vue=amis', u1)
    verifier('/classement entre amis (connecté)', 'Entre amis' in h and 'Toi · @' + u1['nom'] in re.sub(r'<!-- -->', '', h), s)

    s, h = page(f"/u/{u1['nom']}", adm)
    verifier('profil public : @nom, Score Mayele, Suivre, Partager, prédictions récentes', s == 200 and '@' + u1['nom'] in re.sub(r'<!-- -->', '', h) and 'Score Mayele' in h and '>Suivre<' in h and 'Partager' in h and 'Prédictions récentes' in h, s)
    s, h = page(f"/u/{u1['nom']}", u1)
    verifier('mon profil public : « Modifier mon profil » au lieu de Suivre', 'Modifier mon profil' in h and '>Suivre<' not in h)
    s, h = page('/u/Inconnu_xyz_123')
    verifier('profil inconnu : page introuvable', 'Page introuvable.' in h)
    s, h = page('/profil', u1)
    verifier('/profil : mes communautés + lien vers le profil public', 'Mes communautés' in h and 'Voir mon profil public' in h)

    s, h = page('/admin/matchs', adm)
    verifier('admin › Matchs : compteur, ligues, imports, « Importer maintenant »', s == 200 and "Requêtes API aujourd" in h and 'Linafoot' in h and 'Derniers imports' in h and 'Importer maintenant' in h, s)
    verifier('admin : bandeau « Données de test 2024 »', 'Données de test' in h and '2024' in h)
    s, h = page('/admin', adm)
    verifier('admin › Tableau de bord : requêtes API-Football du jour', 'Requêtes API-Football aujourd' in h and 'Dernier import' in h)
    s, h = page('/admin/communautes', adm)
    verifier('admin › Communautés', 'Nouvelle communauté' in h and 'Duels affichés sur la page Classement' in h)
    s, h = page('/admin/pieces', adm)
    verifier('admin › Pièces : bonus à une communauté / N premiers', 'Une communauté' in h and 'Les N premiers du classement' in h)
    s, h = page('/admin/matchs', u1)
    verifier('admin › Matchs refusé à un utilisateur', 'Page introuvable.' in h)
finally:
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('nettoyage fait')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
