import json, sys, random, datetime, subprocess, os, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
PG = sys.argv[2]


def req(methode, chemin, cle, jeton=None, corps=None):
    h = {'apikey': cle, 'Content-Type': 'application/json'}
    if jeton or not cle.startswith('sb_'):
        h['Authorization'] = 'Bearer ' + (jeton or cle)
    r = urllib.request.Request(U + chemin, method=methode, headers=h, data=json.dumps(corps).encode() if corps is not None else None)
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
    print(('OK    ' if cond else 'ECHEC ') + nom + (('  -> ' + str(detail)[:220]) if not cond else ''))


comptes = {}


def creer(etiquette):
    nom = 'Test_%s_%d' % (etiquette, random.randint(1000, 9999))
    mdp = 'Mdp!%d' % random.randint(100000, 999999)
    s, d = req('POST', '/auth/v1/admin/users', S, corps={'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
    uid = d['id']
    s, d = req('POST', '/auth/v1/token?grant_type=password', A, corps={'email': nom.lower() + '@kongox.local', 'password': mdp})
    comptes[etiquette] = {'id': uid, 'jeton': d['access_token'], 'nom': nom}
    return comptes[etiquette]


def rpc(nom, c, corps):
    return req('POST', f'/rest/v1/rpc/{nom}', A, c['jeton'] if c else None, corps)


def rpc_service(nom, corps):
    return req('POST', f'/rest/v1/rpc/{nom}', S, None, corps)


def solde(c):
    return int(sql(f"select solde_pieces from public.utilisateurs where id = '{c['id']}'")[0]['solde_pieces'])


DECALAGE = int(sql("select valeur from public.reglages where cle = 'football_decalage_jours'")[0]['valeur'])
n_ext = [9000000 + random.randint(0, 9000)]


def match_json(statut='NS', dom=None, ext=None, dans_heures=24):
    n_ext[0] += 1
    date_api = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=dans_heures) - datetime.timedelta(days=DECALAGE)
    return {'id_externe': n_ext[0], 'ligue_externe': 39, 'saison': 2024, 'journee': 'Test', 'date_api': date_api.isoformat(), 'statut_api': statut,
            'buts_dom': dom, 'buts_ext': ext, 'dom': {'id_externe': 9900001, 'nom': 'Test KongoX A', 'logo_url': None},
            'ext': {'id_externe': 9900002, 'nom': 'Test KongoX B', 'logo_url': None}}


def options(marche):
    return [int(x['id']) for x in sql(f"select id from public.options_marche where marche_id = {marche} order by ordre")]


try:
    adm, u1, u2, u3 = creer('Adm'), creer('U1'), creer('U2'), creer('U3')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    sql("update public.reglages set valeur = 1 where cle = 'classement_min_predictions'")

    # ---------------- Import d'un match (format commun)
    m1 = match_json()
    s, r = rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [m1]})
    verifier('enregistrer_matchs (clé service) : 1 match', s == 200 and r == 1, (s, r))
    x = sql(f"select m.id, m.statut, m.marche_id, m.date_match, ma.type_reponse, ma.date_fin, ma.statut as statut_marche from public.matchs m join public.marches ma on ma.id = m.marche_id where m.id_externe = {m1['id_externe']}")[0]
    verifier('match à venir + marché 1n2 en ligne qui ferme au coup d\'envoi', x['statut'] == 'a_venir' and x['type_reponse'] == '1n2' and x['statut_marche'] == 'approuve' and x['date_fin'] == x['date_match'], x)
    verifier('décalage de test appliqué (date affichée = date API + décalage)', abs(datetime.datetime.fromisoformat(x['date_match'].replace('Z', '+00:00')) - datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)) < datetime.timedelta(minutes=2), x['date_match'])
    o = options(x['marche_id'])
    verifier('3 options : 1, N, 2', len(o) == 3, o)
    s, r = rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [m1]})
    verifier('réimport : pas de doublon de match ni de marché', sql(f"select count(*) as n from public.matchs where id_externe = {m1['id_externe']}")[0]['n'] == '1'
             and sql("select count(*) as n from public.marches where question like 'Test KongoX A%'")[0]['n'] == '1')
    s, r = rpc('enregistrer_matchs', u1, {'p_fournisseur': 'api_football', 'p_matchs': [match_json()]})
    verifier('un utilisateur ne peut pas importer de matchs', s >= 400, (s, r))

    # ---------------- Mises puis résultat
    rpc('placer_prediction', u1, {'p_marche': x['marche_id'], 'p_option': o[0], 'p_montant': 300})
    rpc('placer_prediction', u2, {'p_marche': x['marche_id'], 'p_option': o[1], 'p_montant': 100})
    rpc('placer_prediction', u3, {'p_marche': x['marche_id'], 'p_option': o[2], 'p_montant': 100})
    s1 = solde(u1)
    m1_ft = dict(m1, statut_api='FT', buts_dom=2, buts_ext=1)
    rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [m1_ft]})
    r = sql(f"select statut, buts_dom from public.matchs where id = {x['id']}")[0]
    verifier('score connu du fournisseur mais match pas encore joué ici : rien de publié', r == {'statut': 'a_venir', 'buts_dom': None}, r)
    sql(f"update public.matchs set date_match = now() - interval '3 hours' where id = {x['id']}; select public.fermer_marches_echus(); select public.appliquer_resultats();")
    r = sql(f"select m.statut, m.buts_dom, m.buts_ext, ma.statut as sm, ma.option_gagnante_id from public.matchs m join public.marches ma on ma.id = m.marche_id where m.id = {x['id']}")[0]
    verifier('fin estimée passée : score publié 2-1, marché réglé sur « 1 »', r['statut'] == 'termine' and r['buts_dom'] == 2 and r['sm'] == 'regle' and int(r['option_gagnante_id']) == o[0], r)
    verifier('gain automatique : le seul gagnant reçoit toute la cagnotte (500)', solde(u1) == s1 + 500, (s1, solde(u1)))

    # ---------------- Match annulé
    m2 = match_json()
    rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [m2]})
    x2 = sql(f"select id, marche_id from public.matchs where id_externe = {m2['id_externe']}")[0]
    o2 = options(x2['marche_id'])
    s2 = solde(u2)
    rpc('placer_prediction', u2, {'p_marche': x2['marche_id'], 'p_option': o2[2], 'p_montant': 150})
    rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [dict(m2, statut_api='CANC')]})
    sql(f"update public.matchs set date_match = now() - interval '3 hours' where id = {x2['id']}; select public.appliquer_resultats();")
    r = sql(f"select statut from public.matchs where id = {x2['id']}")[0]
    verifier('match annulé : statut annulé, mise remboursée', r['statut'] == 'annule' and solde(u2) == s2, (r, s2, solde(u2)))

    # ---------------- Correction manuelle par un admin
    m3 = match_json()
    rpc_service('enregistrer_matchs', {'p_fournisseur': 'api_football', 'p_matchs': [m3]})
    x3 = sql(f"select id, marche_id from public.matchs where id_externe = {m3['id_externe']}")[0]
    o3 = options(x3['marche_id'])
    rpc('placer_prediction', u3, {'p_marche': x3['marche_id'], 'p_option': o3[1], 'p_montant': 200})
    s, r = rpc('corriger_match', u1, {'p_match': int(x3['id']), 'p_buts_dom': 0, 'p_buts_ext': 0, 'p_statut': 'termine'})
    verifier('correction refusée à un utilisateur', s >= 400, (s, r))
    s, r = rpc('corriger_match', adm, {'p_match': int(x3['id']), 'p_buts_dom': 0, 'p_buts_ext': 0, 'p_statut': 'termine'})
    r2 = sql(f"select m.statut, ma.statut as sm, ma.option_gagnante_id from public.matchs m join public.marches ma on ma.id = m.marche_id where m.id = {x3['id']}")[0]
    verifier('admin saisit 0-0 : marché réglé sur « N »', s in (200, 204) and r2['statut'] == 'termine' and int(r2['option_gagnante_id']) == o3[1], (s, r, r2))
    s, r = rpc('corriger_match', adm, {'p_match': int(x3['id']), 'p_buts_dom': 1, 'p_buts_ext': 0, 'p_statut': 'termine'})
    verifier('corriger un match déjà réglé : refusé', s >= 400 and r.get('hint') == 'deja_regle', (s, r))

    # ---------------- Budget de requêtes et imports concurrents
    sql("update public.reglages set valeur = 2 where cle = 'api_football_limite_jour'")
    res = [rpc_service('reserver_appel_api', {'p_fournisseur': 'test_budget'})[1] for _ in range(3)]
    verifier('budget : 2 requêtes autorisées, la 3e refusée', res == [True, True, False], res)
    sql("update public.reglages set valeur = 90 where cle = 'api_football_limite_jour'; delete from public.appels_api where fournisseur = 'test_budget';")
    s, i1 = rpc_service('commencer_import', {'p_type': 'resultats', 'p_declenche_par': 'test'})
    s, i2 = rpc_service('commencer_import', {'p_type': 'resultats', 'p_declenche_par': 'test'})
    verifier('deux imports en même temps : le second est refusé', i1 and i2 is None, (i1, i2))
    rpc_service('terminer_import', {'p_import': i1, 'p_statut': 'ok', 'p_appels': 0, 'p_matchs': 0, 'p_message': 'Test KongoX'})
    s, b = rpc_service('besoins_import', {})
    verifier('besoins_import : saison, décalage et 7 ligues', s == 200 and b['saison'] == 2024 and len(b['ligues']) == 7, (s, b))
    s, r = rpc('besoins_import', u1, {})
    verifier('besoins_import refusé à un utilisateur', s >= 400, (s, r))

    # ---------------- Abonnements
    s, r = rpc('suivre', u1, {'p_nom': u2['nom'].upper(), 'p_suivre': True})
    verifier('suivre un pronostiqueur (nom sans tenir compte des majuscules)', s == 200 and r is True, (s, r))
    s, r = rpc('suivre', u1, {'p_nom': u1['nom'], 'p_suivre': True})
    verifier('se suivre soi-même : refusé', s >= 400 and r.get('hint') == 'soi_meme', (s, r))
    s, r = req('GET', f"/rest/v1/abonnements?suivi_id=eq.{u2['id']}&select=suiveur_id", A)
    verifier('abonnés visibles publiquement', r == [{'suiveur_id': u1['id']}], r)

    # ---------------- Communautés et duels
    s, ca = rpc('creer_communaute', adm, {'p_nom': 'Test Kinshasa %d' % n_ext[0], 'p_type': 'ville', 'p_description': ''})
    s, cb = rpc('creer_communaute', adm, {'p_nom': 'Test Lubumbashi %d' % n_ext[0], 'p_type': 'ville', 'p_description': ''})
    verifier('admin crée deux communautés', isinstance(ca, int) and isinstance(cb, int), (ca, cb))
    s, r = rpc('creer_communaute', u1, {'p_nom': 'Test pirate', 'p_type': 'ville', 'p_description': ''})
    verifier('un utilisateur ne crée pas de communauté', s >= 400, (s, r))
    s, duel = rpc('creer_duel', adm, {'p_titre': 'Villes', 'p_a': ca, 'p_b': cb})
    rpc('rejoindre_communaute', u1, {'p_communaute': ca, 'p_rejoindre': True})
    rpc('rejoindre_communaute', u3, {'p_communaute': cb, 'p_rejoindre': True})
    extra = [rpc('creer_communaute', adm, {'p_nom': 'Test X%d %d' % (k, n_ext[0]), 'p_type': 'autre', 'p_description': ''})[1] for k in range(3)]
    for c in extra[:2]:
        rpc('rejoindre_communaute', u1, {'p_communaute': c, 'p_rejoindre': True})
    s, r = rpc('rejoindre_communaute', u1, {'p_communaute': extra[2], 'p_rejoindre': True})
    verifier('4e communauté refusée (3 au maximum)', s >= 400 and r.get('hint') == 'trop_de_communautes', (s, r))
    s, d = req('POST', '/rest/v1/rpc/duels', A, None, {'p_periode': 'semaine'})
    dd = [z for z in d if z['id'] == duel]
    verifier('duel : Kinshasa (u1 100 %) contre Lubumbashi (u3 50 %) → 67 % / 33 %', len(dd) == 1 and float(dd[0]['score_a']) == 100 and float(dd[0]['score_b']) == 50 and dd[0]['part_a'] == 67, dd)

    # ---------------- Classements
    s, c = req('POST', '/rest/v1/rpc/classement', A, None, {'p_periode': 'semaine', 'p_limite': 200, 'p_amis': False})
    noms = {z['nom_utilisateur']: z for z in c}
    verifier('classement de la semaine : u1 100 %, u3 50 % (1/2), u2 0 %', float(noms[u1['nom']]['score_mayele']) == 100 and float(noms[u3['nom']]['score_mayele']) == 50 and float(noms[u2['nom']]['score_mayele']) == 0, {k: noms[k]['score_mayele'] for k in noms if k.startswith('Test_')})
    verifier('ordre du classement : u1 devant u3 devant u2', noms[u1['nom']]['rang'] < noms[u3['nom']]['rang'] < noms[u2['nom']]['rang'])
    s, c = rpc('classement', u1, {'p_periode': 'semaine', 'p_limite': 50, 'p_amis': True})
    verifier('classement entre amis : moi + ceux que je suis', sorted(z['nom_utilisateur'] for z in c) == sorted([u1['nom'], u2['nom']]), [z['nom_utilisateur'] for z in c])
    s, r = rpc('mon_classement', u3, {'p_periode': 'semaine'})
    verifier('ma place (u3)', s == 200 and r['rang'] == noms[u3['nom']]['rang'] and r['reglees'] == 2, (s, r))
    sql("update public.reglages set valeur = 3 where cle = 'classement_min_predictions'")
    s, c = req('POST', '/rest/v1/rpc/classement', A, None, {'p_periode': 'semaine', 'p_limite': 200, 'p_amis': False})
    verifier('minimum de prédictions (3) : u1 sort du classement', u1['nom'] not in {z['nom_utilisateur'] for z in c})
    sql("update public.reglages set valeur = 1 where cle = 'classement_min_predictions'")

    # ---------------- Profils publics
    s, p = req('POST', '/rest/v1/rpc/profil_public', A, u1['jeton'], {'p_nom': u2['nom']})
    verifier('profil public : stats, 1 abonné, je_suis = vrai', s == 200 and p['abonnes'] == 1 and p['je_suis'] is True and p['predictions'] == 2 and p['soi_meme'] is False, (s, p))
    s, l = req('POST', '/rest/v1/rpc/predictions_publiques', A, None, {'p_nom': u3['nom'], 'p_filtre': 'terminees', 'p_limite': 10})
    verifier('prédictions publiques terminées (u3 : 2)', s == 200 and len(l) == 2 and all(z['statut'] in ('gagnee', 'perdue') for z in l), (s, l))
    s, r = req('GET', '/rest/v1/predictions?select=id', A, u1['jeton'])
    verifier('votes publics (feat/communaute) : prédictions lisibles par tous', s == 200 and len(r) >= 1, (s, r))
    s, r = req('POST', '/rest/v1/rpc/profil_public', A, None, {'p_nom': 'Inconnu_xyz_123'})
    verifier('profil inconnu : rien', r is None, r)

    # ---------------- Bonus en masse : communauté et N premiers
    sb, s3 = solde(u1), solde(u3)
    s, r = rpc('bonus_en_masse', adm, {'p_cible': 'communaute', 'p_noms': None, 'p_montant': 25, 'p_raison': 'Test communauté', 'p_communaute': cb})
    verifier('bonus à une communauté (u3)', s == 200 and r['comptes'] == 1 and solde(u3) == s3 + 25, (s, r))
    s, r = rpc('bonus_en_masse', adm, {'p_cible': 'top', 'p_noms': None, 'p_montant': 10, 'p_raison': 'Test top', 'p_top': 1, 'p_periode': 'semaine'})
    verifier('bonus au 1er du classement', s == 200 and r['comptes'] == 1, (s, r))

    # ---------------- Sécurité
    s, r = req('GET', '/rest/v1/appels_api?select=*', A, u1['jeton'])
    verifier('compteur de requêtes invisible pour un utilisateur', r == [], r)
    s, r = req('POST', '/rest/v1/rpc/appliquer_resultats', A, None, {})
    verifier('appliquer_resultats non appelable sans la clé service', s >= 400, s)
    s, r = req('GET', '/rest/v1/matchs?select=id&limit=1', A)
    verifier('matchs lisibles publiquement', s == 200 and len(r) == 1, (s, r))

    ids = ','.join("'%s'" % z['id'] for z in comptes.values())
    r = sql(f"select (select sum(solde_pieces) from public.utilisateurs where id in ({ids})) as soldes, (select sum(montant) from public.transactions_pieces where utilisateur_id in ({ids})) as journal")[0]
    verifier('soldes = somme du journal des pièces', r['soldes'] == r['journal'], r)
finally:
    sql("update public.reglages set valeur = 5 where cle = 'classement_min_predictions'; update public.reglages set valeur = 90 where cle = 'api_football_limite_jour';")
    sql("""begin;
      delete from public.imports_football where message like 'Test KongoX%';
      delete from public.communautes where nom like 'Test %';
      delete from public.matchs where id_externe >= 9000000;
      delete from public.equipes where id_externe >= 9900000;
      commit;""")
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('nettoyage :', sql("select (select count(*) from public.utilisateurs where nom_utilisateur like 'Test\\_%') as comptes, (select count(*) from public.matchs) as matchs, (select count(*) from public.marches where question like 'Test%') as marches_test, (select count(*) from public.communautes) as communautes, (select valeur from public.reglages where cle='classement_min_predictions') as min_classement"))
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
