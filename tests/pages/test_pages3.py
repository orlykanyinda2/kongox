import re, json, sys, random, base64, datetime, subprocess, os, urllib.request, urllib.error

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
            return rep.status, rep.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def api(methode, chemin, jeton=None, corps=None):
    h = {'apikey': A, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (jeton or A)}
    s, t = req(methode, U + chemin, h, corps)
    try:
        return s, json.loads(t) if t else None
    except Exception:
        return s, t


def sql(requete):
    r = subprocess.run(['node', os.path.join(PG, 'sql.cjs'), '-e', requete], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr)


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


INTROUVABLE = 'Cette page arrive bientôt'
try:
    adm, cur, util = creer('Adm'), creer('Cur'), creer('Util')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    s, cand = api('POST', '/rest/v1/rpc/postuler_curateur', cur['jeton'], {'p_categorie': 'football', 'p_motivation': 'Je suis la Linafoot depuis longtemps, je connais.'})
    api('POST', '/rest/v1/rpc/traiter_candidature', adm['jeton'], {'p_candidature': cand, 'p_accepter': True})
    fin = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=5)).isoformat()
    s, q_foot = api('POST', '/rest/v1/rpc/proposer_marche', util['jeton'], {'p_question': 'Test KongoX : question football en attente ?', 'p_categorie': 'football', 'p_date_fin': fin, 'p_source': 'Test'})
    s, q_mus = api('POST', '/rest/v1/rpc/proposer_marche', util['jeton'], {'p_question': 'Test KongoX : question musique en attente ?', 'p_categorie': 'musique', 'p_date_fin': fin, 'p_source': 'Test'})
    s, q_fin = api('POST', '/rest/v1/rpc/proposer_marche', util['jeton'], {'p_question': 'Test KongoX : marché fermé à régler ?', 'p_categorie': 'politique', 'p_date_fin': fin, 'p_source': 'Test'})
    api('POST', '/rest/v1/rpc/approuver_marche', adm['jeton'], {'p_marche': q_fin})
    sql(f"update public.marches set date_fin = now() - interval '1 hour' where id = {q_fin}")
    api('POST', '/rest/v1/rpc/creer_cadeau', adm['jeton'], {'p_nom_utilisateur': util['nom'], 'p_type': 'forfait_internet', 'p_description': 'Test'})

    # Visiteur et simple utilisateur (le back-office ne s'ouvre pas : pas de menu admin)
    MENU = 'href="/admin/approbation"'
    s, h = page('/admin')
    verifier('visiteur → redirection vers /connexion', 'NEXT_REDIRECT' in h and '/connexion' in h)
    s, h = page('/admin', util)
    verifier('simple utilisateur → pas de back-office (page introuvable)', MENU not in h and 'NEXT_HTTP_ERROR_FALLBACK;404' in h)
    s, h = page('/admin/cadeaux', util)
    verifier('simple utilisateur → /admin/cadeaux introuvable', MENU not in h and 'Marquer un gagnant' not in h)

    # Curateur en essai : envoyé vers sa file d'approbation (thème football seulement)
    s, h = page('/admin', cur)
    verifier("curateur : /admin renvoie vers la file d'approbation", 'NEXT_REDIRECT' in h and '/admin/approbation' in h, s)
    s, h = page('/admin/approbation', cur)
    p_ = h.replace('&#x27;', "'")
    verifier('curateur : voit la question football', 'question football en attente' in h)
    verifier('curateur : ne voit pas la question musique', 'question musique en attente' not in h)
    verifier("curateur en essai : bouton « Proposer d'approuver »", "Proposer d'approuver" in p_)
    verifier('curateur : pas de réinitialisation de mot de passe', 'Générer un mot de passe temporaire' not in h)
    s, h = page('/admin/resultats', cur)
    verifier('curateur → /admin/resultats refusé', 'Régler et verser les gains' not in h and 'marché fermé à régler' not in h)

    # Admin : file d'approbation (les deux thèmes), délais, actions
    s, h = page('/admin/approbation', adm)
    p_ = h.replace('&#x27;', "'").replace('<!-- -->', '')
    for x in ['question football en attente', 'question musique en attente', "Délai moyen d'examen", 'Au-delà de 12 h', 'Approuver', 'Modifier le texte', 'Refuser']:
        verifier('admin /admin/approbation contient « %s »' % x, x in p_)
    s, h = page('/admin/resultats', adm)
    verifier('admin /admin/resultats : marché fermé + formulaire de règlement', 'marché fermé à régler' in h and 'Régler et verser les gains' in h)
    s, h = page(f'/admin/marches/{q_fin}', adm)
    verifier('admin : Soki du jour depuis la fiche du marché', 'Mettre en Soki du jour' in h or 'Soki' in h)
    s, h = page('/admin/utilisateurs?q=Test_Util', adm)
    verifier('admin : recherche utilisateur', util['nom'] in h)
    s, h = page(f"/admin/utilisateurs/{util['id']}", adm)
    verifier('admin : fiche utilisateur (suspension, mot de passe, transactions)', 'Suspendre le compte' in h and 'Générer un mot de passe temporaire' in h and 'Transactions de pièces' in h)
    s, h = page(f"/admin/utilisateurs/{adm['id']}", adm)
    verifier('admin : pas de bouton « Suspendre » sur son propre compte', '>Suspendre le compte<' not in h)
    s, h = page('/admin/cadeaux', adm)
    verifier('admin /admin/cadeaux : gagnant marqué, numéro manquant', 'Marquer un gagnant' in h and util['nom'] in h and 'Numéro manquant' in h)
    s, h = page('/admin/curateurs', adm)
    texte = re.sub(r'<[^>]+>', ' ', h)
    verifier('admin /admin/curateurs : curateur en essai (0 / 10 décisions)', cur['nom'] in h and re.search(r'Essai\s+0\s*/\s*10', texte) is not None)
    s, h = page('/admin/matchs', adm)
    verifier('admin /admin/matchs : import des matchs (étape 4)', 'Importer maintenant' in h)

    # Pages utilisateur
    s, h = page('/curateur', util)
    verifier('/curateur : formulaire de candidature', 'Envoyer ma candidature' in h)
    s, h = page('/profil', util)
    verifier('/profil : changer le mot de passe + devenir curateur', 'Changer mon mot de passe' in h and 'Devenir curateur' in h)
    s, h = page('/profil', cur)
    verifier('/profil curateur : lien vers le panneau admin', 'Ouvrir le panneau admin' in h)
finally:
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('nettoyage fait')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
