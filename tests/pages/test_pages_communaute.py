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


import uuid, html as _html


def creer_invite_page(etiquette):
    nom = 'Test_Inv%s_%d' % (etiquette, random.randint(1000, 9999))
    mdp = 'Mdp!%d' % random.randint(100000, 999999)
    hs = {'apikey': S, 'Content-Type': 'application/json'}
    s, d = req('POST', U + '/auth/v1/admin/users', hs, {'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True,
                                                      'user_metadata': {'nom_utilisateur': nom, 'invite': True}})
    uid = json.loads(d)['id']
    s, d = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': nom.lower() + '@kongox.local', 'password': mdp})
    session = json.loads(d)
    valeur = 'base64-' + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip('=')
    nomc = f'sb-{REF}-auth-token'
    morceaux = [valeur[i:i + 3180] for i in range(0, len(valeur), 3180)]
    cookie = f'{nomc}={valeur}' if len(morceaux) == 1 else '; '.join(f'{nomc}.{i}={m}' for i, m in enumerate(morceaux))
    comptes[etiquette] = {'id': uid, 'nom': nom, 'jeton': session['access_token'], 'cookie': cookie}
    return comptes[etiquette]


def rpc_j(nom, c, corps):
    h = {'apikey': A, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c['jeton']}
    s, t = req('POST', U + f'/rest/v1/rpc/{nom}', h, corps)
    return s, (json.loads(t) if t else None)


def poster_formulaire(chemin, champs, cookie=None, ip='10.0.0.1'):
    # Envoi « sans JavaScript » d'un formulaire de Server Action (amélioration progressive de Next.js)
    limite = '----kongox' + uuid.uuid4().hex
    corps = b''.join(f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in champs) + f'--{limite}--\r\n'.encode()
    h = {'Content-Type': f'multipart/form-data; boundary={limite}', 'X-Forwarded-For': ip}
    if cookie:
        h['Cookie'] = cookie
    r = urllib.request.Request(SITE + chemin, method='POST', headers=h, data=corps)
    try:
        with urllib.request.urlopen(r) as rep:
            return rep.status, rep.read().decode('utf-8', 'replace'), rep.headers.get_all('Set-Cookie') or []
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace'), e.headers.get_all('Set-Cookie') or []


def champs_caches(h, repere):
    # Champs cachés ($ACTION_…) du formulaire rendu qui contient « repere » (un attribut d'un de ses champs)
    i = h.index(repere)
    debut = h.rfind('<form', 0, i)
    bloc = h[debut:h.index('</form>', i)]
    return [(m.group(1), _html.unescape(m.group(2) or '')) for m in re.finditer(r'<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/?>', bloc)]


try:
    adm, u1, u2 = creer('Adm'), creer('U1'), creer('U2')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    m = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut, date_publication)
                   values ('Test KongoX : les invités et les votes publics marchent-ils ?', 'politique', now() + interval '5 days', 'Source', 'approuve', now()) returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m}, 'OUI', 0), ({m}, 'NON', 1)")
    o = [int(x['id']) for x in sql(f"select id from public.options_marche where marche_id = {m} order by ordre")]
    rpc_j('placer_prediction', u1, {'p_marche': m, 'p_option': o[0], 'p_montant': 120})
    rpc_j('placer_prediction', u2, {'p_marche': m, 'p_option': o[1], 'p_montant': 40})
    rpc_j('suivre', u2, {'p_nom': u1['nom'], 'p_suivre': True})

    # ---------------- Visiteur
    s, h = page(f'/marches/{m}')
    verifier('marché (visiteur) : « Vote tout de suite » avec un pseudo proposé', s == 200 and 'Vote tout de suite' in h and re.search(r'id="pseudo-invite"[^>]*value="[A-Za-z0-9_]{3,24}"', h) is not None, s)
    verifier('marché (visiteur) : « Qui a voté » avec les 2 votes', 'Qui a voté' in h and f">@{u1['nom']}<" in h.replace('<!-- -->', '') and f">@{u2['nom']}<" in h.replace('<!-- -->', ''))
    verifier('« Qui a voté » : icônes affichées', '/avatars/' in h)
    verifier('marché (visiteur) : infos visibles sans voter', 'les invités et les votes publics' in h)

    # Vote en invité, vraiment envoyé au serveur (formulaire sans JavaScript)
    pseudo = 'Test_InvForm_%d' % random.randint(1000, 9999)
    ip = '10.%d.%d.%d' % (random.randint(1, 250), random.randint(1, 250), random.randint(1, 250))
    s, h2, cookies = poster_formulaire(f'/marches/{m}', champs_caches(h, 'id="pseudo-invite"') + [('nom', pseudo)], ip=ip)
    sess = [c for c in cookies if c.startswith(f'sb-{REF}-auth-token')]
    app = [c for c in cookies if c.startswith('kx_appareil=')]
    x = sql(f"select id, invite, solde_pieces from public.utilisateurs where nom_utilisateur = '{pseudo}'")
    verifier('formulaire invité : compte invité créé (200 pièces) et connecté (cookie de session)', s == 200 and x and x[0]['invite'] and int(x[0]['solde_pieces']) == 200 and sess, (s, x, [c[:30] for c in cookies]))
    verifier('formulaire invité : cookie d\'appareil httpOnly', app and 'HttpOnly' in app[0], app)
    if x:
        comptes['form'] = {'id': x[0]['id'], 'nom': pseudo}
        verifier('appareil et IP gardés hachés (jamais en clair)', all(len(r['ip_hash']) == 64 and r['ip_hash'] != ip
                                                                         for r in sql(f"select ip_hash from public.appareils_invites where utilisateur_id = '{x[0]['id']}'")))
    s, h3, _ = poster_formulaire(f'/marches/{m}', champs_caches(h, 'id="pseudo-invite"') + [('nom', 'Soki_Master')], ip='10.9.9.%d' % random.randint(1, 250))
    verifier('formulaire invité : pseudo d\'un compte existant refusé', 'Ce pseudo est déjà pris' in h3, s)

    # ---------------- Invité connecté
    inv = creer_invite_page('A')
    s, h = page(f'/marches/{m}', inv)
    verifier('invité : formulaire de prédiction et bandeau « Crée ton compte »', 'name="montant"' in h and 'Tu joues en invité' in h, s)
    verifier('marché politique : avertissement prévu avant de valider', 'Ton nom et ton vote seront visibles par tous.' in h)
    verifier('invité : commentaires bloqués avec invitation à créer un compte', 'Les invités ne peuvent pas commenter' in h and '<textarea' not in h)
    verifier('invité : assistant remplacé par « Crée ton compte »', "Crée ton compte pour poser tes questions à l&#x27;assistant" in h or "Crée ton compte pour poser tes questions à l'assistant" in h)
    s, h = page('/inscription', inv)
    verifier('/inscription (invité) : « Garde tes votes : crée ton compte »', s == 200 and 'Garde tes votes' in h and 'name="mot_de_passe"' in h, s)
    s, h = page('/profil', inv)
    verifier('/profil (invité) : création de compte, cadeaux et communautés réservés', 'Garde tes votes' in h and 'recevoir des cadeaux' in h and 'rejoindre ta communauté' in h and '(invité)' in h, s)
    s, h = page('/', inv)
    verifier('accueil (invité) : « Crée ton compte pour recevoir 100 pièces chaque jour »', 'pour recevoir 100 pièces chaque jour' in h, s)
    s, h = page('/proposer', inv)
    verifier('/proposer (invité) : réservé aux comptes', 'Crée ton compte pour proposer' in h, s)
    s, h = page(f"/u/{inv['nom']}")
    verifier('profil public d\'un invité : mention « invité »', s == 200 and '>invité<' in h.replace('<!-- -->', ''), s)

    # Conversion par le formulaire (sans JavaScript)
    s, h = page('/inscription', inv)
    i = h.index('Garde tes votes')
    champs = champs_caches(h[i:], 'autoComplete="new-password"') + [('mot_de_passe', 'MotDePasse!1'), ('confirmation', 'MotDePasse!1')]
    s, h4, _ = poster_formulaire('/inscription', champs, cookie=inv['cookie'])
    x = sql(f"select invite, ancien_invite, solde_pieces from public.utilisateurs where id = '{inv['id']}'")[0]
    verifier('invité → compte par le formulaire : +1 000 pièces, badge Fidèle', s == 200 and not x['invite'] and x['ancien_invite'] and int(x['solde_pieces']) == 1200
             and len(sql(f"select 1 from public.badges_gagnes where utilisateur_id = '{inv['id']}' and badge_code = 'fidele'")) == 1, (s, x))
    s, d = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': inv['nom'].lower() + '@kongox.local', 'password': 'MotDePasse!1'})
    verifier('ancien invité : connexion avec son nouveau mot de passe', s == 200, s)

    # ---------------- Compte
    s, h = page('/', u2)
    verifier('accueil (compte) : emplacements « personnes que tu suis » sur les cartes', 'data-suivis-marche' in h, s)
    s, h = page(f'/marches/{m}', u2)
    verifier('marché : « 1 personne que tu suis a voté »', '1 personne que tu suis a voté' in h, s)
    s, h = page('/badges', u1)
    verifier('/badges : liste, progression, choix des 4 badges', s == 200 and 'Premier vote' in h and 'Gagné le' in h and '/100 prédictions' in h.replace('<!-- -->', '') and 'Mes 4 badges sur mon profil' in h, s)
    s, h = page('/badges')
    verifier('/badges (visiteur) : liste visible', s == 200 and 'Série de 100 jours' in h, s)
    s, h = page('/profil/icone', u1)
    verifier('/profil/icone : gratuites, élite, boutique, photo et règles', s == 200 and 'Gratuites' in h and 'Élite' in h and 'Boutique' in h and 'Mettre ma photo' in h and 'nudité' in h, s)
    s, h = page('/profil', u1)
    verifier('/profil : icône cliquable et badges', '/profil/icone' in h and '/avatars/' in h and 'Tous mes badges' in h, s)
    s, h = page(f"/u/{u1['nom']}")
    verifier('profil public : icône et badges', '/avatars/' in h and 'Premier vote' in h, s)

    # ---------------- Admin
    s, h = page('/admin/badges', adm)
    verifier('Admin › Badges et icônes : badges, icônes, offrir', s == 200 and 'Créer un badge' in h and 'Offrir le badge' in h and 'Kin la belle' in h and 'Disponible' in h, s)
    s, h = page('/admin/badges?modifier=serie_7', adm)
    verifier('Admin › Badges : modifier un badge', 'Série de 7 jours' in h and 'value="serie_7"' in h, s)
    s, h = page('/admin/badges', u1)
    verifier('Admin › Badges refusé à un utilisateur', 'Créer un badge' not in h)
    s, h = page('/admin', adm)
    verifier('menu admin : « Badges et icônes »', 'href="/admin/badges"' in h)
finally:
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
