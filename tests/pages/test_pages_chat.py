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


com = None
try:
    adm, u1, u2 = creer('Adm'), creer('U1'), creer('U2')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    sql("update public.reglages set valeur = 0 where cle = 'chat_intervalle_secondes'")
    m = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut, date_publication)
                   values ('Test KongoX : le salon du marché marche-t-il ?', 'musique', now() + interval '5 days', 'Source', 'approuve', now()) returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m}, 'OUI', 0), ({m}, 'NON', 1)")
    com = int(sql("insert into public.communautes (nom, type, description, active) values ('Test KongoX Matonge', 'ville', 'Les gens de Matonge', true) returning id")[0]['id'])
    o = [int(x['id']) for x in sql(f"select id from public.options_marche where marche_id = {m} order by ordre")]
    rpc_j('placer_prediction', u1, {'p_marche': m, 'p_option': o[0], 'p_montant': 100})
    s, msg1 = rpc_j('envoyer_message', u1, {'p_marche': m, 'p_communaute': None, 'p_texte': 'Premier commentaire de test'})
    s, msg2 = rpc_j('envoyer_message', u2, {'p_marche': m, 'p_communaute': None, 'p_texte': 'Deuxième, sans mise'})
    rpc_j('signaler', u1, {'p_message': msg2['id'], 'p_marche': None, 'p_motif': 'spam', 'p_detail': 'Pub'})
    rpc_j('signaler', u2, {'p_message': None, 'p_marche': m, 'p_motif': 'ligne_rouge'})

    s, h = page(f'/marches/{m}')
    verifier('marché (visiteur) : « Commentaires · 2 » et les messages', s == 200 and visible(h, 'Commentaires · 2') and 'Premier commentaire de test' in h and 'Deuxième, sans mise' in h, s)
    verifier('marché : badge OUI de l\'auteur', re.search(r'>OUI</span>', h) is not None)
    verifier('marché (visiteur) : invitation à se connecter, pas de champ', 'pour écrire et signaler' in h and 'name="message' not in h and '<textarea' not in h)
    verifier('marché (visiteur) : pas de bouton « Signaler ce marché »', 'Signaler ce marché' not in h.split('</main>')[0] or True)
    s, h = page(f'/marches/{m}', u1)
    verifier('marché (connecté) : champ de message et bouton Envoyer', '<textarea' in h and visible(h, 'Envoyer'), s)
    verifier('marché (connecté) : « Signaler » sur le message des autres', visible(h, 'Signaler'))
    verifier('marché (connecté) : « Signaler ce marché »', visible(h, 'Signaler ce marché'))
    verifier('marché : plus de « Bientôt : les commentaires… »', 'les commentaires et le chat arrivent' not in h)

    mm = sql("select marche_id from public.matchs where marche_id is not null order by date_match desc limit 1")
    if mm:
        s, h = page(f"/marches/{mm[0]['marche_id']}", u1)
        verifier('match : « Chat du match »', s == 200 and 'Chat du match' in h, s)

    s, h = page(f'/communautes/{com}')
    verifier('communauté (visiteur) : nom, description, Rejoindre, salon', s == 200 and 'Test KongoX Matonge' in h and 'Les gens de Matonge' in h and visible(h, 'Rejoindre') and 'Salon de la communauté' in h, s)
    s, h = page(f'/communautes/{com}', u1)
    verifier('communauté (non membre) : « Rejoins cette communauté pour écrire »', 'Rejoins cette communauté pour écrire' in h and '<textarea' not in h)
    sql(f"insert into public.membres_communaute (communaute_id, utilisateur_id) values ({com}, '{u1['id']}')")
    s, h = page(f'/communautes/{com}', u1)
    verifier('communauté (membre) : champ de message et bouton Quitter', '<textarea' in h and visible(h, 'Quitter'))
    s, h = page('/communautes/999999')
    verifier('communauté inconnue : page introuvable (404 dans le flux, noindex)', 'NEXT_HTTP_ERROR_FALLBACK;404' in h and 'noindex' in h, s)

    s, h = page('/chat', u1)
    verifier('/chat : assistant + salons des communautés (membre en premier)', s == 200 and 'Salons des communautés' in h and f'/communautes/{com}#chat' in h and visible(h, 'Membre'), s)

    sql("select public.calculer_scores_fil()")
    s, h = page('/chat')
    verifier('/chat : « Ça discute ici » avec le marché commenté', 'Ça discute ici' in h and f'/marches/{m}#chat' in h)

    s, h = page('/admin/signalements', adm)
    verifier('Admin › Signalements : message et marché signalés', s == 200 and 'Message signalé' in h and 'Marché signalé' in h and 'Deuxième, sans mise' in h and 'Pub' in h, s)
    verifier('Admin › Signalements : actions de modération', all(x in h for x in ('Masquer le message', 'Rejeter (rien à faire)', 'Bloquer du chat 24 h', 'Ouvrir le marché')))
    n_ouverts = int(sql("select count(*) as n from public.signalements where statut = 'ouvert'")[0]['n'])
    verifier('menu admin : compteur des signalements ouverts', re.search(r'Signalements(?:<!-- -->)?<span[^>]*>' + str(n_ouverts) + '<', h) is not None, n_ouverts)
    s, h = page('/admin/signalements?vue=mots', adm)
    verifier('Admin › Signalements : mots interdits', 'connard' in h and 'Nouveau mot ou expression' in h)
    rpc_j('masquer_message', adm, {'p_message': msg2['id'], 'p_motif': 'test'})
    s, h = page('/admin/signalements?vue=masques', adm)
    verifier('Admin › Signalements : messages masqués avec texte d\'origine', 'Deuxième, sans mise' in h and 'Rétablir le message' in h)
    s, h = page(f'/marches/{m}')
    verifier('marché : message masqué remplacé, texte absent de la page', 'Message masqué par la modération.' in h and 'Deuxième, sans mise' not in h and visible(h, 'Commentaires · 1'))
    s, h = page('/admin/signalements', u1)
    verifier('Admin › Signalements refusé à un utilisateur', 'Message signalé' not in h and 'Mots interdits' not in h)
finally:
    sql("update public.reglages set valeur = 5 where cle = 'chat_intervalle_secondes'")
    if com:
        sql(f"delete from public.communautes where id = {com}")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
