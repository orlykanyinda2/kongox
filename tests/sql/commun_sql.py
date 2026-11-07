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


