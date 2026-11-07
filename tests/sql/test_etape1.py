import json, sys, random, datetime, zoneinfo, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip().strip('"')
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']


def req(methode, chemin, cle, jeton=None, corps=None, entetes=None):
    h = {'apikey': cle, 'Content-Type': 'application/json'}
    if jeton or not cle.startswith('sb_'):
        h['Authorization'] = 'Bearer ' + (jeton or cle)
    h.update(entetes or {})
    r = urllib.request.Request(U + chemin, method=methode, headers=h,
                               data=json.dumps(corps).encode() if corps is not None else None)
    try:
        with urllib.request.urlopen(r) as rep:
            t = rep.read().decode()
            return rep.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t


ok = True


def verifier(nom, cond, detail=''):
    global ok
    ok = ok and bool(cond)
    print(('OK    ' if cond else 'ECHEC ') + nom + (('  -> ' + str(detail)[:200]) if not cond else ''))


nom = 'Test_Kx_%d' % random.randint(1000, 9999)
autre = 'Test_Kx_%d' % random.randint(10000, 99999)
mdp = 'MotDePasse!%d' % random.randint(100000, 999999)
ids = []
try:
    # 1. Creation comme le fait le serveur KongoX
    s, d = req('POST', '/auth/v1/admin/users', S, corps={'email': nom.lower() + '@kongox.local', 'password': mdp,
                                                         'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
    verifier('creation du compte (admin)', s == 200, (s, d))
    uid = d['id']
    ids.append(uid)
    s, d = req('GET', f'/rest/v1/utilisateurs?id=eq.{uid}&select=nom_utilisateur,solde_pieces,serie_jours,role', S)
    verifier('profil cree avec 1 000 pieces', d and d[0]['solde_pieces'] == 1000 and d[0]['nom_utilisateur'] == nom and d[0]['role'] == 'utilisateur', d)
    s, d = req('GET', f'/rest/v1/transactions_pieces?utilisateur_id=eq.{uid}&select=montant,type,solde_apres', S)
    verifier('transaction inscription +1000 ecrite', d == [{'montant': 1000, 'type': 'inscription', 'solde_apres': 1000}], d)

    # 2. Meme nom en majuscules : refuse
    s, d = req('POST', '/rest/v1/rpc/nom_utilisateur_disponible', A, corps={'p_nom': nom.upper()})
    verifier('nom deja pris (majuscules ignorees)', d is False, d)
    s, d = req('POST', '/auth/v1/admin/users', S, corps={'email': nom.lower() + '@kongox.local'.replace('@', 'x@'), 'password': mdp,
                                                         'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom.upper()}})
    verifier('doublon de nom refuse par la base', s >= 400, (s, d))
    if s == 200:
        ids.append(d['id'])

    # 3. Inscription publique avec une vraie adresse : refusee par le declencheur
    s, d = req('POST', '/auth/v1/signup', A, corps={'email': 'pirate%d@example.com' % random.randint(1, 99999), 'password': mdp,
                                                    'data': {'nom_utilisateur': autre}})
    verifier('inscription publique hors KongoX refusee', s >= 400, (s, d))
    if s == 200 and isinstance(d, dict):
        x = d.get('id') or (d.get('user') or {}).get('id')
        if x:
            ids.append(x)

    # 4. Connexion
    s, d = req('POST', '/auth/v1/token?grant_type=password', A, corps={'email': nom.lower() + '@kongox.local', 'password': mdp})
    verifier('connexion avec le mot de passe', s == 200 and 'access_token' in d, (s, d))
    J = d['access_token']
    s, d = req('POST', '/auth/v1/token?grant_type=password', A, corps={'email': nom.lower() + '@kongox.local', 'password': 'mauvais'})
    verifier('mauvais mot de passe refuse (invalid_credentials)', s == 400 and d.get('error_code') == 'invalid_credentials', (s, d))

    # 5. Bonus quotidien
    s, d = req('POST', '/rest/v1/rpc/reclamer_bonus_quotidien', A, J, {})
    verifier('bonus du jour accorde (+100, serie 1)', s == 200 and d['accorde'] and d['solde'] == 1100 and d['serie_jours'] == 1, d)
    s, d = req('POST', '/rest/v1/rpc/reclamer_bonus_quotidien', A, J, {})
    verifier('deuxieme bonus le meme jour refuse', s == 200 and not d['accorde'] and d['solde'] == 1100, d)
    s, d = req('POST', '/rest/v1/rpc/reclamer_bonus_quotidien', A, None, {})
    verifier('bonus refuse sans connexion', s >= 400, (s, d))

    # 6. Serie : jour rate -> repart a 1 ; 7e jour de suite -> +200
    req('PATCH', f'/rest/v1/utilisateurs?id=eq.{uid}', S, corps={'dernier_bonus_le': '2000-01-01', 'serie_jours': 6}, entetes={'Prefer': 'return=minimal'})
    s, d = req('POST', '/rest/v1/rpc/reclamer_bonus_quotidien', A, J, {})
    verifier('jour rate : la serie repart a 1', d['accorde'] and d['serie_jours'] == 1 and d['bonus_serie'] == 0, d)
    hier = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))).date() - datetime.timedelta(days=1)).isoformat()
    req('PATCH', f'/rest/v1/utilisateurs?id=eq.{uid}', S, corps={'dernier_bonus_le': hier, 'serie_jours': 6}, entetes={'Prefer': 'return=minimal'})
    s0 = req('GET', f'/rest/v1/utilisateurs?id=eq.{uid}&select=solde_pieces', S)[1][0]['solde_pieces']
    s, d = req('POST', '/rest/v1/rpc/reclamer_bonus_quotidien', A, J, {})
    verifier('7e jour de suite : +100 +200', d['accorde'] and d['serie_jours'] == 7 and d['bonus_serie'] == 200 and d['solde'] == s0 + 300, d)
    s, d = req('GET', f'/rest/v1/utilisateurs?id=eq.{uid}&select=solde_pieces', S)
    s2, d2 = req('GET', f'/rest/v1/transactions_pieces?utilisateur_id=eq.{uid}&select=montant', S)
    verifier('solde = somme des transactions (aucune piece perdue ni doublee)', d[0]['solde_pieces'] == sum(x['montant'] for x in d2), (d, d2))

    # 7. Securite des pieces
    s, d = req('PATCH', f'/rest/v1/utilisateurs?id=eq.{uid}', A, J, {'solde_pieces': 999999})
    verifier('modifier son solde depuis le navigateur : refuse', s in (401, 403), (s, d))
    s, d = req('POST', '/rest/v1/transactions_pieces', A, J, {'utilisateur_id': uid, 'montant': 5000, 'type': 'inscription', 'solde_apres': 5000})
    verifier('ecrire une transaction : refuse', s in (401, 403), (s, d))
    s, d = req('POST', '/rest/v1/rpc/mouvement_pieces', A, J, {'p_utilisateur': uid, 'p_montant': 5000, 'p_type': 'inscription'})
    verifier('appeler mouvement_pieces : refuse', s in (401, 403, 404), (s, d))
    s, d = req('PATCH', f'/rest/v1/transactions_pieces?utilisateur_id=eq.{uid}', S, corps={'montant': 1})
    verifier('modifier une transaction, meme en admin : refuse', s >= 400, (s, d))
    s, d = req('PATCH', f'/rest/v1/utilisateurs?id=eq.{uid}', S, corps={'solde_pieces': -5})
    verifier('solde negatif : refuse', s >= 400, (s, d))

    # 8. Coordonnees privees
    s, d = req('PATCH', f'/rest/v1/coordonnees_utilisateurs?utilisateur_id=eq.{uid}', A, J,
               {'telephone': '+243812345678', 'email_contact': 'test@example.com'}, {'Prefer': 'return=representation'})
    verifier('enregistrer son telephone et son e-mail', s == 200 and d and d[0]['telephone'] == '+243812345678', (s, d))
    s, d = req('PATCH', f'/rest/v1/coordonnees_utilisateurs?utilisateur_id=eq.{uid}', A, J, {'telephone': '0812'})
    verifier('telephone mal forme : refuse', s >= 400, (s, d))
    s, d = req('GET', '/rest/v1/coordonnees_utilisateurs?select=*', A)
    verifier('coordonnees invisibles sans connexion', s in (401, 403) or d == [], (s, d))
    s, d = req('GET', '/rest/v1/utilisateurs?select=nom_utilisateur&limit=1', A)
    verifier('profils publics lisibles', s == 200, (s, d))
    s, d = req('GET', '/rest/v1/transactions_pieces?select=*', A)
    verifier('historiques invisibles sans connexion', s in (401, 403) or d == [], (s, d))
finally:
    for i in ids:
        s, _ = req('DELETE', f'/auth/v1/admin/users/{i}', S)
        print('nettoyage : compte de test supprime' if s == 200 else f'nettoyage : ECHEC suppression {i} ({s})')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
