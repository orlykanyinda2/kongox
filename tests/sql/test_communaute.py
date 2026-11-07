import json, sys, random, subprocess, os, urllib.request, urllib.error, uuid

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
    print(('OK    ' if cond else 'ECHEC ') + nom + (('  -> ' + str(detail)[:300]) if not cond else ''))


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


def marche(question, categorie, publie_il_y_a_h, fin_dans_h=24 * 30):
    m = sql(f"""insert into public.marches (question, categorie, date_fin, source, statut, date_publication, examine_le)
                values ('Test KongoX fil : {question}', '{categorie}', now() + interval '{fin_dans_h} hours', 'Source de test',
                        'approuve', now() - interval '{publie_il_y_a_h} hours', now() - interval '{publie_il_y_a_h} hours') returning id""")[0]['id']
    m = int(m)
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m}, 'OUI', 0), ({m}, 'NON', 1)")
    return m


def options(m):
    return [int(x['id']) for x in sql(f"select id from public.options_marche where marche_id = {m} order by ordre")]


def miser(c, m, oui, montant):
    o = options(m)
    s, r = rpc('placer_prediction', c, {'p_marche': m, 'p_option': o[0 if oui else 1], 'p_montant': montant})
    assert s == 200, (s, r)


def sections():
    return {s['cle']: [int(x) for x in s['marches']] for s in sql("select public.fil_sections() as f")[0]['f']}


def reglage(cle, valeur):
    sql(f"update public.reglages_fil set valeur = {valeur} where cle = '{cle}'")


import hashlib, base64


def hint(r):
    return r.get('hint') if isinstance(r, dict) else None


def h64(s):
    return hashlib.sha256(s.encode()).hexdigest()


def creer_invite(etiquette):
    nom = 'Test_Inv%s_%d' % (etiquette, random.randint(1000, 9999))
    mdp = 'Mdp!%d' % random.randint(100000, 999999)
    s, d = req('POST', '/auth/v1/admin/users', S, corps={'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True,
                                                         'user_metadata': {'nom_utilisateur': nom, 'invite': True}})
    uid = d['id']
    s, d = req('POST', '/auth/v1/token?grant_type=password', A, corps={'email': nom.lower() + '@kongox.local', 'password': mdp})
    comptes[etiquette] = {'id': uid, 'jeton': d['access_token'], 'nom': nom}
    return comptes[etiquette]


def solde(c):
    return int(sql(f"select solde_pieces from public.utilisateurs where id = '{c['id']}'")[0]['solde_pieces'])


def badges(c):
    return {r['badge_code'] for r in sql(f"select badge_code from public.badges_gagnes where utilisateur_id = '{c['id']}'")}


def televerser(c, chemin, contenu, type_mime):
    r = urllib.request.Request(U + '/storage/v1/object/avatars/' + chemin, method='POST', data=contenu,
                               headers={'apikey': A, 'Authorization': 'Bearer ' + c['jeton'], 'Content-Type': type_mime})
    try:
        with urllib.request.urlopen(r) as rep:
            return rep.status
    except urllib.error.HTTPError as e:
        return e.code


ORIG = {r['cle']: r['valeur'] for r in sql("select cle, valeur from public.reglages where valeur is not null")}
fichiers = []
try:
    adm, u1, u2, u3, u4 = creer('Adm'), creer('U1'), creer('U2'), creer('U3'), creer('U4')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    sql("update public.reglages set valeur = 0 where cle = 'chat_intervalle_secondes'")

    # ---------------- Invités
    inv = creer_invite('A')
    x = sql(f"select invite, icone, solde_pieces from public.utilisateurs where id = '{inv['id']}'")[0]
    t = sql(f"select type, montant from public.transactions_pieces where utilisateur_id = '{inv['id']}'")
    verifier('invité : 200 pièces d\'essai (type essai_invite), icône gratuite au hasard', x['invite'] and int(x['solde_pieces']) == 200 and t == [{'type': 'essai_invite', 'montant': '200'}]
             and sql(f"select niveau from public.icones where code = '{x['icone']}'")[0]['niveau'] == 'gratuite', (x, t))
    verifier('compte normal : 1 000 pièces et une icône', solde(u1) == 1000 and sql(f"select icone from public.utilisateurs where id = '{u1['id']}'")[0]['icone'] is not None)
    m = marche('les invités votent-ils bien ?', 'musique', 1)
    o = options(m)
    s, r = rpc('placer_prediction', inv, {'p_marche': m, 'p_option': o[0], 'p_montant': 100})
    verifier('invité : vote comptant dans la cagnotte', s == 200 and int(sql(f"select total_mise from public.options_marche where id = {o[0]}")[0]['total_mise']) == 100, (s, r))
    for nom_f, corps in [('reserver_question_ia', {}), ('proposer_marche', {'p_question': 'Test KongoX : un invité peut-il proposer ?', 'p_categorie': 'musique', 'p_date_fin': '2030-01-01T00:00:00Z', 'p_source': 'Source test'}),
                         ('envoyer_message', {'p_marche': m, 'p_communaute': None, 'p_texte': 'Salut'}), ('suivre', {'p_nom': u1['nom'], 'p_suivre': True}),
                         ('reclamer_bonus_quotidien', {}), ('signaler', {'p_message': None, 'p_marche': m, 'p_motif': 'spam'}),
                         ('acheter_icone', {'p_code': 'ville'}), ('postuler_curateur', {'p_categorie': 'musique', 'p_motivation': 'Je veux aider la communauté musique.'})]:
        s, r = rpc(nom_f, inv, corps)
        verifier(f'invité : {nom_f} refusé (reserve_comptes)', s >= 400 and hint(r) == 'reserve_comptes', (s, r))
    cid = sql("select id from public.communautes where active limit 1")
    if cid:
        s, r = rpc('rejoindre_communaute', inv, {'p_communaute': int(cid[0]['id']), 'p_rejoindre': True})
        verifier('invité : rejoindre une communauté refusé', hint(r) == 'reserve_comptes', (s, r))
    s, r = rpc('creer_cadeau', adm, {'p_nom_utilisateur': inv['nom'], 'p_type': 'credit', 'p_description': 'test'})
    verifier('cadeau refusé pour un invité', hint(r) == 'invite_sans_cadeau', (s, r))
    s, r = rpc('choisir_icone', inv, {'p_code': 'ballon'})
    verifier('invité : choisir une icône gratuite', s in (200, 204) and sql(f"select icone from public.utilisateurs where id = '{inv['id']}'")[0]['icone'] == 'ballon', (s, r))

    # Appareil et adresse IP
    ip = h64('ip-test-%d' % random.randint(0, 10**9))
    app1 = h64('appareil-1-%d' % random.randint(0, 10**9))
    s, r = rpc_service('preparer_invite', {'p_appareil_hash': app1, 'p_ip_hash': ip})
    verifier('preparer_invite : appareil inconnu → nouvel invité', s == 200 and r == {'existant': None}, (s, r))
    rpc_service('lier_appareil_invite', {'p_appareil_hash': app1, 'p_ip_hash': ip, 'p_utilisateur': inv['id']})
    s, r = rpc_service('preparer_invite', {'p_appareil_hash': app1, 'p_ip_hash': ip})
    verifier('un seul invité par appareil : l\'invité existant est renvoyé', r == {'existant': inv['id']}, r)
    sql(f"insert into public.appareils_invites (appareil_hash, ip_hash) values ('{h64('x1' + ip)}', '{ip}'), ('{h64('x2' + ip)}', '{ip}')")
    s, r = rpc_service('preparer_invite', {'p_appareil_hash': h64('nouveau' + ip), 'p_ip_hash': ip})
    verifier('limite par adresse IP (3 par jour)', hint(r) == 'limite_invites', (s, r))
    s, r = rpc('preparer_invite', u1, {'p_appareil_hash': app1, 'p_ip_hash': ip})
    verifier('preparer_invite interdit au navigateur', s >= 400, s)
    s, r = req('GET', '/rest/v1/appareils_invites?select=ip_hash', A, u1['jeton'])
    verifier('appareils des invités illisibles', s >= 400 or r == [], (s, r))

    # Classement : invité exclu
    sql("update public.reglages set valeur = 1 where cle = 'classement_min_predictions'")
    rpc('placer_prediction', u1, {'p_marche': m, 'p_option': o[0], 'p_montant': 50})
    rpc('regler_marche', adm, {'p_marche': m, 'p_option_gagnante': o[0], 'p_lien_resultat': 'https://exemple.com/resultat'})
    st = sql(f"select statut from public.marches where id = {m}")[0]['statut']
    cl = [r['utilisateur_id'] for r in sql("select utilisateur_id from public.classement_complet('semaine')")]
    verifier('classements : l\'invité gagnant n\'est pas classé, le compte oui', st == 'regle' and inv['id'] not in cl and u1['id'] in cl, (st, cl[:5]))

    # Conversion
    solde_avant = solde(inv)
    s, r = rpc('convertir_invite', inv, {'p_utilisateur': inv['id']})
    verifier('convertir_invite interdit au navigateur', s >= 400, s)
    s, r = rpc_service('convertir_invite', {'p_utilisateur': inv['id']})
    x = sql(f"select invite, ancien_invite, nom_utilisateur from public.utilisateurs where id = '{inv['id']}'")[0]
    verifier('invité → compte : même pseudo, mêmes votes, +1 000 pièces', s == 200 and not x['invite'] and x['ancien_invite'] and x['nom_utilisateur'] == inv['nom']
             and solde(inv) == solde_avant + 1000 and len(sql(f"select 1 from public.predictions where utilisateur_id = '{inv['id']}'")) == 1, (s, r, x))
    verifier('badge Fidèle donné au passage', 'fidele' in badges(inv), badges(inv))
    verifier('appareil libéré après la conversion', len(sql(f"select 1 from public.appareils_invites where appareil_hash = '{app1}'")) == 0)
    s, r = rpc('envoyer_message', inv, {'p_marche': m, 'p_communaute': None, 'p_texte': 'Je suis membre maintenant !'})
    verifier('ancien invité : peut commenter', s == 200, (s, r))
    s, r = rpc_service('convertir_invite', {'p_utilisateur': inv['id']})
    verifier('conversion une seule fois', hint(r) == 'pas_invite', (s, r))

    # Fermeture après inactivité
    inv2 = creer_invite('B')
    m2 = marche('un invité fermé garde-t-il ses mises ?', 'vie_quotidienne', 1)
    o2 = options(m2)
    rpc('placer_prediction', inv2, {'p_marche': m2, 'p_option': o2[1], 'p_montant': 80})
    sql(f"update public.utilisateurs set derniere_activite = now() - interval '31 days' where id = '{inv2['id']}'")
    n = sql("select public.fermer_invites_inactifs() as n")[0]['n']
    x = sql(f"select nom_utilisateur, ferme_le is not null as ferme from public.utilisateurs where id = '{inv2['id']}'")[0]
    a = sql(f"select banned_until > now() as banni, email from auth.users where id = '{inv2['id']}'")[0]
    verifier('invité inactif 30 jours : compte fermé, pseudo libéré, connexion coupée', n >= 1 and x['ferme'] and x['nom_utilisateur'].startswith('invite_') and a['banni'] and a['email'].startswith('ferme-'), (n, x, a))
    verifier('ses mises restent dans la cagnotte', int(sql(f"select total_mise from public.options_marche where id = {o2[1]}")[0]['total_mise']) == 80)
    s, r = req('POST', '/rest/v1/rpc/votes_marche', A, None, {'p_marche': m2, 'p_ordre': None, 'p_tri': 'recents', 'p_decalage': 0, 'p_limite': 20})
    verifier('« Qui a voté » : invité fermé affiché sans nom (« invité »)', s == 200 and len(r) == 1 and r[0]['nom'] is None and r[0]['invite'], (s, r))
    verifier('pseudo libéré : réutilisable', sql(f"select public.nom_utilisateur_disponible('{inv2['nom']}') as ok")[0]['ok'])
    s, r = req('POST', '/rest/v1/rpc/profil_public', A, None, {'p_nom': x['nom_utilisateur']})
    verifier('invité fermé : plus de profil public', s == 200 and r is None, (s, r))

    # ---------------- Votes publics
    m3 = marche('qui a voté sur ce marché ?', 'politique', 1)
    o3 = options(m3)
    rpc('placer_prediction', u1, {'p_marche': m3, 'p_option': o3[0], 'p_montant': 30})
    rpc('placer_prediction', u2, {'p_marche': m3, 'p_option': o3[1], 'p_montant': 200})
    rpc('placer_prediction', u3, {'p_marche': m3, 'p_option': o3[0], 'p_montant': 60})

    def votes(**k):
        corps = dict({'p_marche': m3, 'p_ordre': None, 'p_tri': 'recents', 'p_decalage': 0, 'p_limite': 20}, **k)
        s, r = req('POST', '/rest/v1/rpc/votes_marche', A, None, corps)
        assert s == 200, (s, r)
        return r
    r = votes()
    verifier('« Qui a voté » public (visiteur) : 3 votes, du plus récent au plus ancien', [v['nom'] for v in r] == [u3['nom'], u2['nom'], u1['nom']] and int(r[0]['total']) == 3, [v['nom'] for v in r])
    verifier('chaque vote : icône, choix, pièces, heure', all(v['icone'] and v['choix'] in ('OUI', 'NON') and v['montant'] and v['cree_le'] for v in r))
    r = votes(p_ordre=0)
    verifier('filtre OUI', {v['nom'] for v in r} == {u1['nom'], u3['nom']} and int(r[0]['total']) == 2, r)
    r = votes(p_tri='mises')
    verifier('tri par plus grosse mise', [int(v['montant']) for v in r] == [200, 60, 30], r)
    r = votes(p_limite=2, p_decalage=2)
    verifier('pagination', len(r) == 1 and int(r[0]['total']) == 3, r)
    attente = int(sql("insert into public.marches (question, categorie, date_fin, source, statut) values ('Test KongoX : marché caché des votes ?', 'musique', now() + interval '2 days', 'Source', 'en_attente') returning id")[0]['id'])
    verifier('marché en attente : pas de votes visibles', votes(p_marche=attente) == [])
    s, r = req('GET', f'/rest/v1/predictions?select=id,montant&marche_id=eq.{m3}', A)
    verifier('prédictions lisibles par un visiteur (vote public)', s == 200 and len(r) == 3, (s, r))
    rpc('suivre', u4, {'p_nom': u2['nom'], 'p_suivre': True})
    rpc('suivre', u4, {'p_nom': u3['nom'], 'p_suivre': True})
    s, r = rpc('suivis_ayant_vote', u4, {'p_marches': [m3, m2]})
    verifier('« 2 personnes que tu suis ont voté »', s == 200 and r == [{'marche_id': m3, 'nombre': 2}], (s, r))
    s, r = req('POST', '/rest/v1/rpc/suivis_ayant_vote', A, None, {'p_marches': [m3]})
    verifier('suivis_ayant_vote réservé aux comptes', s >= 400, s)

    # ---------------- Badges
    verifier('badge Premier vote après la première prédiction', 'premier_vote' in badges(u1) and 'premier_vote' in badges(u2), (badges(u1), badges(u2)))
    m4 = marche('dix petites mises pour un badge ?', 'vie_quotidienne', 1)
    o4 = options(m4)
    for _ in range(8):
        rpc('placer_prediction', u1, {'p_marche': m4, 'p_option': o4[0], 'p_montant': 10})
    verifier('badge 10 prédictions', 'predictions_10' in badges(u1), badges(u1))
    sql(f"update public.utilisateurs set serie_jours = 7 where id = '{u2['id']}'")
    verifier('badge série de 7 jours (déclencheur sur la série)', 'serie_7' in badges(u2), badges(u2))
    sql("update public.reglages set valeur = 2 where cle = 'badge_mayele_min'")
    rpc('regler_marche', adm, {'p_marche': m3, 'p_option_gagnante': o3[0], 'p_lien_resultat': 'https://exemple.com/r'})
    verifier('badges Mayele 60/70/80 % après le règlement (2 sur 2 gagnées)', {'mayele_60', 'mayele_70', 'mayele_80'} <= badges(u1), badges(u1))
    verifier('pas de badge Mayele pour qui a perdu', not ({'mayele_60'} & badges(u2)), badges(u2))
    q = int(sql(f"""insert into public.marches (question, categorie, date_fin, source, statut, auteur_id) values
                    ('Test KongoX : une question proposée par U3 ?', 'musique', now() + interval '3 days', 'Source', 'en_attente', '{u3['id']}') returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({q}, 'OUI', 0), ({q}, 'NON', 1)")
    rpc('approuver_marche', adm, {'p_marche': q})
    verifier('badge Créateur de marché à l\'approbation', 'createur_1' in badges(u3), badges(u3))
    s, r = rpc('enregistrer_badge', adm, {'p_code': 'bavard', 'p_nom': 'Bavard', 'p_description': 'Écrire 2 commentaires (test).', 'p_glyphe': 'bulle', 'p_niveau': 'bronze',
                                         'p_famille': 'Communauté', 'p_condition': 'bavard', 'p_seuil': 2, 'p_actif': True})
    verifier('admin : badge modifié (journal)', s in (200, 204) and len(sql(f"select 1 from public.journal_admin where action = 'badge_modifie' and auteur_id = '{adm['id']}'")) == 1, (s, r))
    rpc('envoyer_message', u4, {'p_marche': m4, 'p_communaute': None, 'p_texte': 'Premier message'})
    rpc('envoyer_message', u4, {'p_marche': m4, 'p_communaute': None, 'p_texte': 'Deuxième message'})
    verifier('badge Bavard après le N-ième commentaire', 'bavard' in badges(u4), badges(u4))
    s, r = rpc('enregistrer_badge', u1, {'p_code': 'faux', 'p_nom': 'Faux', 'p_description': 'Faux badge test.', 'p_glyphe': 'etoile', 'p_niveau': 'or',
                                        'p_famille': 'x', 'p_condition': 'manuel', 'p_seuil': 0, 'p_actif': True})
    verifier('créer un badge : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('enregistrer_badge', adm, {'p_code': 'test_kx_badge', 'p_nom': 'Badge test', 'p_description': 'Créé par les tests.', 'p_glyphe': 'etoile', 'p_niveau': 'or',
                                         'p_famille': 'Tests', 'p_condition': 'manuel', 'p_seuil': 0, 'p_actif': True})
    s, r = rpc('offrir_badge', adm, {'p_nom_utilisateur': u2['nom'], 'p_code': 'test_kx_badge'})
    verifier('admin : badge créé puis offert (journal)', 'test_kx_badge' in badges(u2) and len(sql(f"select 1 from public.journal_admin where action = 'badge_offert' and cible_utilisateur = '{u2['id']}'")) == 1, (s, r))
    s, r = rpc('offrir_badge', adm, {'p_nom_utilisateur': u2['nom'], 'p_code': 'test_kx_badge'})
    verifier('badge déjà gagné', hint(r) == 'deja_gagne', (s, r))
    s, r = rpc('progression_badges', u1, {})
    p10 = next((b for b in r if b['code'] == 'predictions_100'), None)
    verifier('progression : « 10/100 prédictions »', p10 and p10['valeur'] == 10 and p10['gagne_le'] is None, p10)
    s, r = req('POST', '/rest/v1/rpc/progression_badges', A, None, {})
    verifier('liste des badges visible par un visiteur (sans progression)', s == 200 and len(r) >= 20 and all(b['valeur'] is None for b in r), s)
    s, r = rpc('badges_a_montrer', u1, {})
    verifier('« Nouveau badge ! » : badges non vus', s == 200 and {'premier_vote', 'predictions_10'} <= {b['code'] for b in r}, r)
    rpc('marquer_badges_vus', u1, {})
    s, r = rpc('badges_a_montrer', u1, {})
    verifier('badges marqués vus', r == [], r)
    s, r = rpc('choisir_badges_vedette', u1, {'p_codes': ['premier_vote', 'mayele_80']})
    verifier('4 badges mis en avant (ici 2)', s in (200, 204) and sql(f"select badges_vedette from public.utilisateurs where id = '{u1['id']}'")[0]['badges_vedette'] == ['mayele_80', 'premier_vote'], (s, r))
    s, r = rpc('choisir_badges_vedette', u1, {'p_codes': ['serie_100']})
    verifier('mettre en avant un badge non gagné : refusé', hint(r) == 'badge_non_gagne', (s, r))
    s, r = rpc('choisir_badges_vedette', u1, {'p_codes': ['premier_vote', 'mayele_80', 'mayele_70', 'mayele_60', 'predictions_10']})
    verifier('plus de 4 badges : refusé', hint(r) == 'hors_limites', (s, r))
    s, r = req('POST', '/rest/v1/rpc/profil_public', A, None, {'p_nom': u1['nom']})
    verifier('profil public : badges (mis en avant d\'abord), icône', s == 200 and r['badges'][0]['vedette'] and r['icone'], r.get('badges', [])[:2] if isinstance(r, dict) else r)
    s, r = req('POST', '/rest/v1/badges_gagnes', A, u1['jeton'], {'utilisateur_id': u1['id'], 'badge_code': 'serie_100'})
    verifier('aucun badge ne s\'écrit depuis le navigateur', s >= 400, s)
    s, r = rpc('verifier_badges', u1, {'p_utilisateur': u1['id']})
    verifier('verifier_badges interdit au navigateur', s >= 400, s)

    # ---------------- Icônes
    s, r = rpc('choisir_icone', u1, {'p_code': 'diamant'})
    verifier('icône de boutique non achetée : refusée', hint(r) == 'icone_indisponible', (s, r))
    s, r = rpc('choisir_icone', u1, {'p_code': 'couronne'})
    verifier('icône élite sans le badge : refusée', hint(r) == 'icone_indisponible', (s, r))
    sv = solde(u4)
    s, r = rpc('acheter_icone', u4, {'p_code': 'ville'})
    prix = int(sql("select prix from public.icones where code = 'ville'")[0]['prix'])
    verifier('achat d\'une icône : pièces débitées (achat_icone) et icône portée', s == 200 and solde(u4) == sv - prix
             and sql(f"select type, montant from public.transactions_pieces where utilisateur_id = '{u4['id']}' order by id desc limit 1")[0] == {'type': 'achat_icone', 'montant': str(-prix)}
             and sql(f"select icone from public.utilisateurs where id = '{u4['id']}'")[0]['icone'] == 'ville', (s, r))
    s, r = rpc('acheter_icone', u4, {'p_code': 'ville'})
    verifier('pas de double achat', hint(r) == 'deja_possedee' and solde(u4) == sv - prix, (s, r))
    s, r = rpc('acheter_icone', u4, {'p_code': 'diamant'})
    verifier('solde insuffisant : refusé, rien n\'est débité ni possédé', hint(r) == 'solde_insuffisant' and solde(u4) == sv - prix
             and len(sql(f"select 1 from public.icones_possedees where utilisateur_id = '{u4['id']}' and icone_code = 'diamant'")) == 0, (s, r))
    s, r = rpc('acheter_icone', u4, {'p_code': 'lion'})
    verifier('icône gratuite : pas à acheter', hint(r) == 'icone_indisponible', (s, r))
    rpc('choisir_icone', u4, {'p_code': 'ballon'})
    s, r = rpc('choisir_icone', u4, {'p_code': 'ville'})
    verifier('icône achetée : reste à moi', s in (200, 204), (s, r))
    rpc('offrir_badge', adm, {'p_nom_utilisateur': u1['nom'], 'p_code': 'top10_mois'})
    s, r = rpc('choisir_icone', u1, {'p_code': 'couronne'})
    verifier('badge Top 10 du mois : icône élite Couronne débloquée', s in (200, 204), (s, r))
    s, r = rpc('offrir_icone', adm, {'p_nom_utilisateur': u2['nom'], 'p_code': 'diamant', 'p_porter': True})
    verifier('admin : icône offerte et portée (journal)', sql(f"select icone from public.utilisateurs where id = '{u2['id']}'")[0]['icone'] == 'diamant'
             and len(sql(f"select 1 from public.journal_admin where action = 'icone_changee' and cible_utilisateur = '{u2['id']}'")) == 1, (s, r))
    s, r = rpc('modifier_icone', u1, {'p_code': 'ville', 'p_prix': 1, 'p_actif': True})
    verifier('prix des icônes : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('modifier_icone', adm, {'p_code': 'ville', 'p_prix': 750, 'p_actif': True})
    verifier('admin : nouveau prix', int(sql("select prix from public.icones where code = 'ville'")[0]['prix']) == 750, (s, r))
    rpc('modifier_icone', adm, {'p_code': 'ville', 'p_prix': prix, 'p_actif': True})
    s, r = req('POST', '/rest/v1/icones_possedees', A, u1['jeton'], {'utilisateur_id': u1['id'], 'icone_code': 'diamant', 'origine': 'achat'})
    verifier('aucune icône ne s\'obtient depuis le navigateur', s >= 400, s)
    s, r = req('PATCH', f"/rest/v1/utilisateurs?id=eq.{u1['id']}", A, u1['jeton'], {'icone': 'diamant'})
    verifier('l\'icône ne se change pas en écrivant la table', sql(f"select icone from public.utilisateurs where id = '{u1['id']}'")[0]['icone'] == 'couronne', (s, r))

    # Photos (Supabase Storage)
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
    ch1 = f"{u1['id']}/test-{random.randint(1000, 9999)}.png"
    verifier('photo : envoi dans mon dossier accepté', televerser(u1, ch1, png, 'image/png') == 200)
    fichiers.append(ch1)
    verifier('photo : envoi dans le dossier d\'un autre refusé', televerser(u1, f"{u2['id']}/pirate.png", png, 'image/png') >= 400)
    inv3 = creer_invite('C')
    verifier('photo : refusée pour un invité', televerser(inv3, f"{inv3['id']}/x.png", png, 'image/png') >= 400)
    verifier('photo : plus de 500 Ko refusée', televerser(u3, f"{u3['id']}/gros.png", png + b'0' * 600_000, 'image/png') >= 400)
    verifier('photo : format non accepté refusé', televerser(u3, f"{u3['id']}/x.gif", b'GIF89a', 'image/gif') >= 400)
    s, r = rpc('definir_photo', u1, {'p_chemin': f"{u1['id']}/inexistante.png"})
    verifier('definir_photo : fichier absent refusé', hint(r) == 'photo_invalide', (s, r))
    s, r = rpc('definir_photo', u1, {'p_chemin': ch1})
    verifier('definir_photo : la photo devient l\'image de profil', s in (200, 204) and sql(f"select photo from public.utilisateurs where id = '{u1['id']}'")[0]['photo'] == ch1, (s, r))
    s, r = rpc('signaler', u1, {'p_message': None, 'p_marche': None, 'p_motif': 'photo', 'p_utilisateur': u1['id']})
    verifier('signaler sa propre photo : refusé', hint(r) == 'soi_meme', (s, r))
    for c in (u2, u3):
        rpc('signaler', c, {'p_message': None, 'p_marche': None, 'p_motif': 'photo', 'p_utilisateur': u1['id']})
    verifier('2 signalements : photo encore là', sql(f"select photo from public.utilisateurs where id = '{u1['id']}'")[0]['photo'] == ch1)
    s, r = rpc('signaler', u4, {'p_message': None, 'p_marche': None, 'p_motif': 'photo', 'p_utilisateur': u1['id']})
    verifier('3e signalement : photo retirée automatiquement, icône de retour', r == 'masque' and sql(f"select photo, icone from public.utilisateurs where id = '{u1['id']}'")[0] == {'photo': None, 'icone': 'couronne'}, (s, r))
    rpc('definir_photo', u1, {'p_chemin': ch1})
    s, r = rpc('retirer_photo', u4, {'p_utilisateur': u1['id'], 'p_motif': 'x'})
    verifier('retirer une photo : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('retirer_photo', adm, {'p_utilisateur': u1['id'], 'p_motif': 'Test'})
    verifier('admin : photo retirée, signalements clos (journal)', s == 200 and r == ch1 and sql(f"select photo from public.utilisateurs where id = '{u1['id']}'")[0]['photo'] is None
             and len(sql(f"select 1 from public.signalements where utilisateur_cible = '{u1['id']}' and statut = 'ouvert'")) == 0, (s, r))

    # Pièces : aucune perdue ni doublée
    ok_pieces = sql("select bool_and(u.solde_pieces = coalesce((select sum(montant) from public.transactions_pieces t where t.utilisateur_id = u.id), 0)) as ok from public.utilisateurs u where u.nom_utilisateur like 'Test\\_%' or u.nom_utilisateur like 'invite\\_%'")[0]['ok']
    verifier('pièces : chaque solde = somme de ses transactions', ok_pieces)
finally:
    for k, v in ORIG.items():
        if k in ('chat_intervalle_secondes', 'classement_min_predictions', 'badge_mayele_min'):
            sql(f"update public.reglages set valeur = {v} where cle = '{k}'")
    sql("update public.badges set seuil = 100, description = 'Écrire 100 commentaires.' where code = 'bavard'")
    sql("delete from public.badges_gagnes where badge_code = 'test_kx_badge'; delete from public.badges where code = 'test_kx_badge'")
    for f in fichiers:
        req('DELETE', '/storage/v1/object/avatars/' + f, S)
    sql("delete from public.appareils_invites where utilisateur_id is null")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
