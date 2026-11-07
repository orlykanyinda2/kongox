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


def rpc_j(nom, c, corps):
    h = {'apikey': A, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c['jeton']}
    s, t = req('POST', U + f'/rest/v1/rpc/{nom}', h, corps)
    return s, (json.loads(t) if t else None)


def section_mes_mises(h):
    # Le bloc « Mes mises sur ce marché » rendu dans la page (pas les données envoyées au navigateur)
    propre = h.replace('<!-- -->', '')
    i = propre.find('>Mes mises sur ce marché<')
    if i < 0:
        return ''
    return propre[i:propre.find('</section>', i)]


# Garde-fou : les prédictions sont publiques, mais « mes » prédictions ne montrent que les miennes.
# A et B misent sur le même marché des montants reconnaissables : chacun ne doit voir que les siens.
try:
    a, b = creer('A'), creer('B')
    m = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut, date_publication)
                   values ('Test KongoX : chacun ne voit que ses mises ?', 'musique', now() + interval '5 days', 'Source', 'approuve', now()) returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m}, 'OUI', 0), ({m}, 'NON', 1)")
    o = [int(x['id']) for x in sql(f"select id from public.options_marche where marche_id = {m} order by ordre")]
    rpc_j('placer_prediction', a, {'p_marche': m, 'p_option': o[0], 'p_montant': 37})
    rpc_j('placer_prediction', b, {'p_marche': m, 'p_option': o[1], 'p_montant': 53})
    rpc_j('placer_prediction', b, {'p_marche': m, 'p_option': o[1], 'p_montant': 29})

    s, h = page(f'/marches/{m}', a)
    bloc = section_mes_mises(h)
    verifier('page du marché (A) : « Mes mises » montre la mise de A (37)', s == 200 and '37' in bloc, (s, bloc[:300]))
    verifier('page du marché (A) : « Mes mises » ne montre pas les mises de B (53, 29)', bloc and '53' not in bloc and '29' not in bloc, bloc[:300])
    s, h = page(f'/marches/{m}', b)
    bloc = section_mes_mises(h)
    verifier('page du marché (B) : ses 2 mises, pas celle de A', '53' in bloc and '29' in bloc and '37' not in bloc, bloc[:300])
    verifier('« Qui a voté » montre bien les 3 votes à tout le monde (public)', all(f'>{x} pièces<' in h.replace('<!-- -->', '').replace(' · ', '>') or f'{x} pièces' in h for x in ('37', '53', '29')))

    # Message « fais une pause » : calculé sur MES 3 dernières prédictions réglées, pas sur celles des autres
    m2 = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut, date_publication)
                    values ('Test KongoX : série de pertes de qui ?', 'musique', now() + interval '5 days', 'Source', 'approuve', now()) returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m2}, 'OUI', 0), ({m2}, 'NON', 1)")
    sql(f"""insert into public.predictions (utilisateur_id, marche_id, option_id, montant, statut, cree_le)
            select '{b['id']}', {m}, {o[1]}, 10, 'perdue', now() - (g || ' minutes')::interval from generate_series(1, 3) g""")
    s, h = page(f'/marches/{m2}', a)
    verifier('« Fais une pause » : pas déclenché par les pertes de B', not re.search(r'<p role="status"[^>]*>Fais une pause', h), s)
    s, h = page(f'/marches/{m2}', b)
    verifier('« Fais une pause » : bien déclenché pour B (3 pertes de suite)', re.search(r'<p role="status"[^>]*>Fais une pause', h) is not None, s)
finally:
    sql(f"delete from public.predictions where utilisateur_id in ('{a['id']}', '{b['id']}') and montant = 10 and statut = 'perdue'" if 'b' in dir() else 'select 1')
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
