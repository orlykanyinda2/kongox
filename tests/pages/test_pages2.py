import json, sys, random, base64, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
REF = U.split('//')[1].split('.')[0]
SITE = 'http://localhost:3123'


def req(methode, url, entetes, corps=None):
    r = urllib.request.Request(url, method=methode, headers=entetes, data=json.dumps(corps).encode() if corps is not None else None)
    try:
        with urllib.request.urlopen(r) as rep:
            return rep.status, rep.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


ok = True


def verifier(nom, cond, detail=''):
    global ok
    ok = ok and bool(cond)
    print(('OK    ' if cond else 'ECHEC ') + nom + (('  -> ' + str(detail)[:200]) if not cond else ''))


def page(chemin, cookie=None):
    return req('GET', SITE + chemin, {'Cookie': cookie} if cookie else {})


# --- Visiteur
s, h = page('/')
verifier('accueil 200', s == 200, s)
for x in ['Le Congo a un avis.', 'Prouve-le.', 'Soki du jour', 'Les Léopards vont-ils se qualifier pour la CAN 2027 ?',
          'Marchés en direct', 'Fally Ipupa sortira-t-il', 'CE QUE PENSE KINSHASA', 'Comment ça marche', 'Commencer — 1 000 pièces offertes']:
    verifier('accueil contient « %s »' % x, x in h)
verifier('aucune donnée en dur des maquettes (« 124 350 »)', '124 350' not in h and '78 %' not in h)

s, d = req('GET', U + '/rest/v1/marches?select=id&soki_du_jour=eq.true', {'apikey': A})
soki = json.loads(d)[0]['id']
s, h = page(f'/marches/{soki}')
verifier('page du marché 200', s == 200, s)
for x in ['Les Léopards vont-ils se qualifier', 'Source : Site officiel de la CAF', 'Créer mon compte — 1 000 pièces', 'Partager sur WhatsApp', '24 h']:
    verifier('marché (visiteur) contient « %s »' % x, x in h)

s, h = page('/marches/999999')
verifier('marché inexistant → page « bientôt / introuvable »', 'Page introuvable.' in h, s)
s, h = page('/football')
verifier('/football → page « bientôt »', 'Page introuvable.' in h, s)
s, h = page('/proposer')
verifier('/proposer sans connexion → redirection /connexion', 'NEXT_REDIRECT' in h and '/connexion' in h)

# --- Connecté
nom = 'Test_P_%d' % random.randint(1000, 9999)
mdp = 'Mdp!%d' % random.randint(100000, 999999)
hs = {'apikey': S, 'Content-Type': 'application/json'}
s, d = req('POST', U + '/auth/v1/admin/users', hs, {'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
uid = json.loads(d)['id']
try:
    s, d = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': nom.lower() + '@kongox.local', 'password': mdp})
    session = json.loads(d)
    valeur = 'base64-' + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip('=')
    nomc = f'sb-{REF}-auth-token'
    morceaux = [valeur[i:i + 3180] for i in range(0, len(valeur), 3180)]
    cookie = f'{nomc}={valeur}' if len(morceaux) == 1 else '; '.join(f'{nomc}.{i}={m}' for i, m in enumerate(morceaux))

    s, h = page('/', cookie)
    verifier('accueil connecté : solde « 1 000 » dans l\'en-tête', '1 000' in h and 'Mon profil' in h, s)
    s, h = page(f'/marches/{soki}?choix=non', cookie)
    for x in ['Combien de pièces ?', 'Gain possible si tu as raison', 'Limite : 2 000 pièces par jour', 'Solde : 1 000']:
        verifier('marché (connecté) contient « %s »' % x, x in h)
    verifier('pas de message « pause » sans pertes', 'bg-champagne p-3.5' not in h)
    s, h = page('/proposer', cookie)
    for x in ['+50 pièces et le badge', 'Ta question', 'Source de la réponse', 'Envoyer pour approbation', 'Refusé : la mort']:
        verifier('proposer contient « %s »' % x, x in h)
    s, h = page('/profil', cookie)
    verifier('profil : section « Mes questions proposées »', 'Mes questions proposées' in h, s)
finally:
    req('DELETE', U + f'/auth/v1/admin/users/{uid}', hs)
    print('nettoyage : compte de test supprimé')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
