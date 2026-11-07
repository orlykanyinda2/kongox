import json, sys, random, base64, subprocess, os, re, time, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
PG = sys.argv[2]
REF = U.split('//')[1].split('.')[0]
SITE, SITE_PANNE = 'http://localhost:3123', 'http://localhost:3124'


def req(methode, url, entetes, corps=None, timeout=60):
    r = urllib.request.Request(url, method=methode, headers=entetes, data=json.dumps(corps).encode() if corps is not None else None)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as rep:
            return rep.status, rep.read().decode('utf-8'), {k.lower(): v for k, v in rep.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), {k.lower(): v for k, v in e.headers.items()}


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


def creer(etiquette):
    nom = 'Test_%s_%d' % (etiquette, random.randint(1000, 9999))
    mdp = 'Mdp!%d' % random.randint(100000, 999999)
    hs = {'apikey': S, 'Content-Type': 'application/json'}
    s, d, _ = req('POST', U + '/auth/v1/admin/users', hs, {'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
    uid = json.loads(d)['id']
    s, d, _ = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': nom.lower() + '@kongox.local', 'password': mdp})
    session = json.loads(d)
    valeur = 'base64-' + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip('=')
    nomc = f'sb-{REF}-auth-token'
    morceaux = [valeur[i:i + 3180] for i in range(0, len(valeur), 3180)]
    cookie = f'{nomc}={valeur}' if len(morceaux) == 1 else '; '.join(f'{nomc}.{i}={m}' for i, m in enumerate(morceaux))
    return {'id': uid, 'nom': nom, 'jeton': session['access_token'], 'cookie': cookie}


def demander(c, question, marche=None, site=SITE, historique=None):
    corps = {'marche': marche, 'messages': (historique or []) + [{'role': 'user', 'content': question}]}
    t0 = time.time()
    s, texte, ent = req('POST', site + '/api/assistant', {'Content-Type': 'application/json', **({'Cookie': c['cookie']} if c else {})}, corps)
    return s, texte, ent, round(time.time() - t0, 1)


def usage():
    r = sql("select * from public.ia_usage_jour where jour = (now() at time zone 'Africa/Kinshasa')::date")
    return r[0] if r else {}


def rpc(nom, c, corps):
    s, t, _ = req('POST', f'{U}/rest/v1/rpc/{nom}', {'apikey': A, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (c['jeton'] if c else A)}, corps)
    try:
        return s, json.loads(t) if t else None
    except Exception:
        return s, t


comptes = []
try:
    u1 = creer('IA1'); comptes.append(u1)
    u2 = creer('IA2'); comptes.append(u2)
    soki = sql("select id, question from public.marches where soki_du_jour limit 1")[0]
    match = sql("select m.marche_id, d.nom as dom, e.nom as ext from public.matchs m join public.equipes d on d.id = m.equipe_dom_id join public.equipes e on e.id = m.equipe_ext_id where m.statut = 'a_venir' and m.date_match > now() + interval '1 hour' order by m.date_match limit 1")[0]

    # ---------------- Base : limites
    s, r = rpc('questions_ia_restantes', u2, {})
    verifier('questions restantes au départ : 20', r == 20, r)
    s, r = rpc('reserver_question_ia', None, {})
    verifier('réserver sans connexion : refusé', s >= 400, (s, r))
    s, r = rpc('enregistrer_usage_ia', u2, {'p_entree': 1, 'p_sortie': 1, 'p_cache_lus': 0, 'p_cache_ecrits': 0})
    verifier('enregistrer_usage_ia refusé à un utilisateur', s >= 400, (s, r))
    s, r = req('GET', f'{U}/rest/v1/ia_usage_jour?select=*', {'apikey': A, 'Authorization': 'Bearer ' + u2['jeton']})[:2]
    verifier('consommation invisible pour un utilisateur', r.strip() == '[]', r)

    # ---------------- Visiteur
    s, t, _, _ = demander(None, 'Bonjour')
    verifier('visiteur : 401 + message « Connecte-toi »', s == 401 and 'Connecte-toi' in t, (s, t))

    # ---------------- Réponse en streaming (français, marché)
    u0 = usage()
    s, t, ent, d = demander(u1, 'Que pense la communauté de ce marché ?', soki['id'])
    pct = sql(f"select round(100.0 * coalesce(sum(total_mise) filter (where ordre = 0), 0) / nullif(sum(total_mise), 0)) as p from public.options_marche where marche_id = {soki['id']}")[0]['p'] or 50
    print(f'      [français, {d} s] {t.strip()[:400]}')
    verifier('réponse en français reçue (200, texte non vide, sans erreur)', s == 200 and len(t.strip()) > 20 and '\u0001' not in t, (s, t))
    verifier(f'la réponse cite le vrai pourcentage du contexte ({pct} %)', str(int(float(pct))) in t, t)
    verifier('en-tête X-Questions-Restantes = 19', ent.get('x-questions-restantes') == '19', ent.get('x-questions-restantes'))

    # ---------------- Lingala, match
    s, t, ent, d = demander(u1, 'Nani akolonga match oyo ? Bato bakanisi nini ?', match['marche_id'])
    print(f'      [lingala, {d} s] {t.strip()[:400]}')
    mots = ['bato', 'ezali', ' na ', 'te', 'kasi', 'bakanisi', 'oyo', 'ya ']
    verifier('réponse en lingala (mots lingala présents)', s == 200 and sum(1 for m in mots if m in t.lower()) >= 3, t)
    verifier('cite une des équipes du match', match['dom'].split()[0] in t or match['ext'].split()[0] in t, t)

    # ---------------- Argent réel : refus poli
    s, t, ent, d = demander(u1, 'Je veux parier de vrai argent sur ce match, tu me conseilles quel site ?', match['marche_id'])
    print(f'      [argent réel, {d} s] {t.strip()[:300]}')
    verifier('demande d\'argent réel : rappel des pièces gratuites, aucun site conseillé', 'gratuit' in t.lower() and not re.search(r'1xbet|betway|bet9ja|premierbet|sportybet', t.lower()), t)

    # ---------------- Cache et consommation
    u1u = usage()
    verifier('consommation enregistrée (3 requêtes de plus)', int(u1u.get('requetes', 0)) - int(u0.get('requetes', 0)) == 3, (u0, u1u))
    verifier('prompt caching : des jetons sont lus en cache', int(u1u.get('jetons_cache_lus', 0)) > int(u0.get('jetons_cache_lus', 0)), (u0.get('jetons_cache_lus'), u1u.get('jetons_cache_lus'), u1u.get('jetons_cache_ecrits')))

    # ---------------- Limite par personne
    sql("update public.reglages set valeur = 3 where cle = 'ia_questions_par_jour'")
    s, t, ent, _ = demander(u1, 'Encore une question ?')
    verifier('4e question avec une limite de 3 : 429 + message poli', s == 429 and 'questions du jour' in t, (s, t))
    sql("update public.reglages set valeur = 20 where cle = 'ia_questions_par_jour'")

    # ---------------- Plafond global
    q = int(usage().get('questions', 0))
    sql(f"update public.reglages set valeur = {q} where cle = 'ia_plafond_global_jour'")
    s, t, ent, _ = demander(u2, 'Bonjour ?')
    verifier('plafond global atteint : 429 + message poli', s == 429 and 'demain' in t, (s, t))
    s, r = rpc('questions_ia_restantes', u2, {})
    verifier('la question refusée par le plafond n\'est pas comptée', r == 20, r)
    sql("update public.reglages set valeur = 2000 where cle = 'ia_plafond_global_jour'")

    # ---------------- Panne de l'API (serveur lancé avec une clé invalide)
    avant = usage()
    s, t, ent, d = demander(u2, 'Bonjour, ça marche ?', site=SITE_PANNE)
    print(f'      [panne, {d} s] {t.strip()[:200]}')
    verifier('API en panne : message clair', s == 200 and '\u0001' in t and 'ne répond pas' in t, (s, t))
    s, r = rpc('questions_ia_restantes', u2, {})
    verifier('API en panne : la question est rendue (toujours 20)', r == 20, r)
    verifier('API en panne : erreur comptée', int(usage().get('erreurs', 0)) == int(avant.get('erreurs', 0)) + 1, usage())
    s, h, _ = req('GET', SITE_PANNE + '/', {})
    verifier('API en panne : le reste du site marche', s == 200 and 'Le Congo a un avis' in h, s)

    # ---------------- Affichage
    s, h, _ = req('GET', f"{SITE}/marches/{soki['id']}", {})
    verifier('visiteur : exemple lingala + « Crée ton compte — 1 000 pièces offertes »', 'Ba Léopards bakolonga lobi' in h and 'Crée ton compte — 1 000 pièces offertes' in h, s)
    s, h, _ = req('GET', f"{SITE}/marches/{soki['id']}", {'Cookie': u1['cookie']})
    verifier('connecté : champ de question + questions restantes', 'Écris en lingala, swahili, français' in h and 'question' in h, s)
    s, h, _ = req('GET', f"{SITE}/chat", {'Cookie': u1['cookie']})
    verifier('/chat : l\'assistant en grand', s == 200 and 'Demande à l' in h, s)
finally:
    sql("update public.reglages set valeur = 20 where cle = 'ia_questions_par_jour'; update public.reglages set valeur = 2000 where cle = 'ia_plafond_global_jour';")
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('nettoyage fait')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
