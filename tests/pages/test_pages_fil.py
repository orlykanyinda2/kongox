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


import uuid, time


def post(chemin, corps, entetes=None):
    h = {'Content-Type': 'application/json'}
    h.update(entetes or {})
    r = urllib.request.Request(SITE + chemin, method='POST', headers=h, data=corps if isinstance(corps, bytes) else json.dumps(corps).encode())
    try:
        with urllib.request.urlopen(r) as rep:
            return rep.status
    except urllib.error.HTTPError as e:
        return e.code


try:
    adm, u1 = creer('Adm'), creer('U1')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    # Données propres à ce test (marché avec accent pour la recherche, assez de marchés pour 2 pages)
    for i in range(14):
        q = "Test KongoX fil : Équipe politique : le débat aura-t-il lieu ?" if i == 0 else f"Test KongoX fil : marché de remplissage numéro {i} ?"
        mid = int(sql(f"insert into public.marches (question, categorie, date_fin, source, statut, date_publication) values ('{q}', 'vie_quotidienne', now() + interval '10 days', 'Source', 'approuve', now() - interval '{i} hours') returning id")[0]['id'])
        sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({mid}, 'OUI', 0), ({mid}, 'NON', 1)")
    sql("select public.calculer_scores_fil()")
    # Les sections de l'accueil et les recherches sont en cache (60 s) : on laisse le cache se renouveler
    page('/'); page('/marches'); page('/marches?q=equipe%20politique')
    time.sleep(65)
    page('/'); page('/marches'); page('/marches?q=equipe%20politique')
    time.sleep(3)
    sx = {x['cle']: [int(i) for i in x['marches']] for x in sql("select public.fil_sections() as f")[0]['f']}

    s, h = page('/')
    verifier('accueil 200', s == 200, s)
    for cle, titre in (('tendances', 'Tendances'), ('nouveaux', 'Nouveaux'), ('bientot', 'Bientôt fermés')):
        if sx.get(cle):
            verifier(f'accueil : section « {titre} » affichée', f'id="fil-{cle}"' in h and visible(h, titre))
    verifier('accueil : sections phase 2 absentes', 'id="fil-hausse"' not in h and 'id="fil-divise"' not in h and 'id="fil-pour_toi"' not in h)
    verifier('accueil : bouton « Voir tous les marchés » vers /marches', 'href="/marches"' in h and visible(h, 'Voir tous les marchés'))
    verifier('accueil : la section « Matchs à venir » reste', 'Matchs à venir' in h)
    paires = re.findall(r'data-fil-marche="(\d+)" data-fil-section="([a-z_]+)"', h)
    hors_soki = [int(i) for i, sct in paires if sct != 'soki']
    soki = sorted({int(i) for i, sct in paires if sct == 'soki'})
    verifier('accueil : aucune carte en double hors Soki', len(hors_soki) == len(set(hors_soki)), hors_soki)
    verifier('accueil : le Soki du jour n\'est pas répété dans une section', len(soki) == 1 and not (set(soki) & set(hors_soki)), (soki, hors_soki))
    verifier('accueil : cartes suivies avec section et position', 'data-fil-position="1"' in h and len(hors_soki) >= 6, len(hors_soki))
    attendu = [i for k in ('tendances', 'bientot', 'nouveaux') for i in sx.get(k, []) if i not in soki]
    verifier('accueil : l\'ordre des cartes suit fil_sections', hors_soki == attendu, (hors_soki, attendu))

    s, h = page('/admin/reglages', adm)
    verifier('Admin › Réglages : tables du fil (sections, coefficients, affichage)', s == 200 and 'Fil de marchés : sections' in h and 'coef_a' in h and 'diversite_max' in h and 'Recalculer maintenant' in h, s)

    s, h = page('/marches')
    verifier('/marches : 200, titre, filtres', s == 200 and visible(h, 'Tous les marchés') and 'name="categorie"' in h and 'name="tri"' in h and 'name="statut"' in h, s)
    total = int(sql("select total from public.rechercher_marches('', null, null, null, null, 0, 1)")[0]['total'])
    verifier('/marches : nombre total affiché', visible(h, f'{total} marchés'), total)
    cartes = re.findall(r'data-fil-marche="(\d+)"', h)
    verifier('/marches : 12 cartes au premier chargement', len(cartes) == min(12, total), len(cartes))
    verifier('/marches : bouton de chargement progressif', (total > 12) == visible(h, 'Voir plus de marchés'))
    verifier('en-tête : la recherche mène à /marches', 'action="/marches"' in h)
    s, h = page('/marches?q=equipe%20politique')
    verifier('/marches?q= : recherche sans accent', s == 200 and 'Équipe politique' in h and visible(h, '1 marché pour « equipe politique »'), s)
    s, h = page('/marches?categorie=football&tri=plus_mises')
    foot = int(sql("select count(*) as n from public.marches where categorie = 'football' and type_reponse = 'oui_non' and statut = 'approuve' and date_fin > now()")[0]['n'])
    verifier('/marches : filtre catégorie lu dans l\'URL', s == 200 and visible(h, f'{foot} marché' + ('s' if foot > 1 else '')), (s, foot))
    s, h = page('/marches?tri=n_importe_quoi&statut=%3Cscript%3E&categorie=xx&communaute=abc')
    verifier('/marches : paramètres invalides ignorés (pas d\'erreur)', s == 200 and visible(h, f'{total} marchés'), s)
    s, h = page('/marches?q=zzzzzzzzz')
    verifier('/marches : message quand rien ne correspond', visible(h, 'Aucun marché ne correspond. Essaie un autre mot ou enlève un filtre.'))

    # Route d'événements
    v, vi = str(uuid.uuid4()), str(uuid.uuid4())
    corps = {'visiteur_id': v, 'visite_id': vi, 'evenements': [{'type': 'affiche', 'marche_id': hors_soki[0], 'section': 'tendances', 'position': 1, 'page': '/'},
                                                                {'type': 'clic', 'marche_id': hors_soki[0], 'section': 'tendances', 'position': 1, 'page': '/'}]}
    verifier('/api/evenements : 204 (visiteur)', post('/api/evenements', corps) == 204)
    verifier('/api/evenements : 204 (connecté)', post('/api/evenements', dict(corps, visite_id=str(uuid.uuid4())), {'Cookie': u1['cookie']}) == 204)
    verifier('/api/evenements : identifiant invalide refusé (400)', post('/api/evenements', dict(corps, visiteur_id='abc')) == 400)
    verifier('/api/evenements : JSON invalide refusé (400)', post('/api/evenements', b'{pas du json') == 400)
    verifier('/api/evenements : corps trop gros refusé (413)', post('/api/evenements', b'x' * 20000) == 413)
    time.sleep(3)
    r = sql(f"select type, utilisateur_id from public.evenements_fil where visiteur_id = '{v}' order by id")
    verifier('/api/evenements : enregistrés après la réponse, utilisateur reconnu', len(r) == 4 and sum(1 for x in r if x['utilisateur_id'] == u1['id']) == 2, r)

    s, h = page('/admin', adm)
    verifier('tableau de bord : section « Fil de marchés »', s == 200 and 'Fil de marchés' in h and 'Taux de clic' in h and 'Retour J1' in h and 'Prédictions par visite' in h, s)
    verifier('tableau de bord : ligne Tendances', 'Tendances' in h)
    s, h = page('/admin', u1)
    verifier('tableau de bord refusé à un utilisateur', 'Fil de marchés' not in h)
finally:
    sql(f"delete from public.evenements_fil where visiteur_id = '{v}'" if 'v' in dir() else "select 1")
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
