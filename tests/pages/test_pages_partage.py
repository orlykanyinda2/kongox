import time
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


def page_ua(chemin, ua):
    return req('GET', SITE + chemin, {'User-Agent': ua})


try:
    adm, u1 = creer('Adm'), creer('U1')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    m = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut, date_publication, sponsor)
                   values ('Test KongoX : la carte de partage est-elle belle ?', 'musique', now() + interval '5 days', 'Source', 'approuve', now(), 'Marque Test')
                   returning id""")[0]['id'])
    sql(f"insert into public.options_marche (marche_id, libelle, ordre) values ({m}, 'OUI', 0), ({m}, 'NON', 1)")

    # ---------------- Partage sur la page d'un marché
    s, h = page(f'/marches/{m}')
    verifier('marché : boutons WhatsApp, Facebook, Telegram, TikTok, Copier le lien', s == 200 and all(x in h for x in ('Partager sur WhatsApp', 'Facebook', 'Telegram', 'TikTok', 'Copier le lien')), s)
    verifier('marché : liens de partage corrects', 'https://wa.me/?text=' in h and 'facebook.com/sharer/sharer.php?u=' in h and 't.me/share/url?url=' in h)
    verifier('marché : « Télécharger la carte » vers la carte image', f'/marches/{m}/opengraph-image' in h and 'Télécharger la carte' in h)
    verifier('marché sponsorisé : « Question offerte par Marque Test »', 'Question offerte par Marque Test' in h)
    s, h = page_ua(f'/marches/{m}', 'WhatsApp/2.23.20.0 A')
    tete = h.split('</head>')[0]
    verifier('aperçu WhatsApp : og:title, og:description, og:image dans <head>', 'property="og:title" content="Test KongoX : la carte de partage est-elle belle ?"' in tete
             and 'property="og:description"' in tete and f'/marches/{m}/opengraph-image' in tete and 'name="twitter:card" content="summary_large_image"' in tete)
    r = urllib.request.urlopen(SITE + f'/marches/{m}/opengraph-image')
    verifier('carte image du marché : PNG 1200 × 630', r.status == 200 and r.headers['Content-Type'] == 'image/png' and r.read(24)[16:24] == bytes.fromhex('000004b000000276'))
    r = urllib.request.urlopen(SITE + '/marches/99999999/opengraph-image')
    verifier('carte image d\'un marché inconnu : carte générique (pas d\'erreur)', r.status == 200 and r.headers['Content-Type'] == 'image/png')
    attente = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut) values ('Test KongoX : marché caché en attente ?', 'musique', now() + interval '3 days', 'Source', 'en_attente') returning id""")[0]['id'])
    s, h = page_ua(f'/marches/{attente}', 'WhatsApp/2.23.20.0 A')
    verifier('marché en attente : question absente de l\'aperçu', 'marché caché en attente' not in h.split('</head>')[0])

    # ---------------- Profil, communauté, classement
    s, h = page(f"/u/{u1['nom']}")
    verifier('profil public : boutons de partage et carte du profil', s == 200 and 'Partager sur WhatsApp' in h and f"/u/{u1['nom']}/opengraph-image" in h, s)
    r = urllib.request.urlopen(SITE + f"/u/{u1['nom']}/opengraph-image")
    verifier('carte image du profil : PNG', r.status == 200 and r.headers['Content-Type'] == 'image/png')
    s, h = page('/classement', u1)
    verifier('classement : bloc de partage', s == 200 and ('Partage ta place' in h or 'Partager le classement' in h) and 'Partager sur WhatsApp' in h, s)
    r = urllib.request.urlopen(SITE + '/opengraph-image')
    verifier('carte image du site', r.status == 200 and r.headers['Content-Type'] == 'image/png')
    s, h = page_ua('/', 'facebookexternalhit/1.1')
    verifier('accueil : aperçu Facebook avec la carte du site', '/opengraph-image' in h.split('</head>')[0] and 'property="og:site_name" content="KongoX"' in h)

    # ---------------- Page partenaires
    s, h = page('/partenaires')
    verifier('/partenaires : titre, 7 offres, formulaire', s == 200 and 'Grandissons ensemble.' in h and 'Gagnez avec nous.' in h and h.count('<strong>Ce que vous gagnez :</strong>') == 7
             and 'Envoyer ma demande' in h and 'name="contact"' in h, s)
    verifier('/partenaires : « Postuler » mène à la candidature curateur', 'href="/curateur"' in h)
    verifier('/partenaires : champ piège à robots caché', 'name="site_web"' in h and 'aria-hidden="true"' in h)
    verifier('/partenaires : mention « jamais d\'argent réel »', 'jamais d&#x27;argent réel' in h or "jamais d'argent réel" in h)
    sql("update public.reglages set texte = '243810000000' where cle = 'whatsapp_equipe'")
    time.sleep(1)
    s, h = page('/partenaires?type=media')
    verifier('/partenaires?type=media : type présélectionné', 'value="media" selected' in h.replace('selected=""', 'selected') or re.search(r'<option value="media"[^>]*selected', h) is not None or '"typeInitial":"media"' in h)
    s, h = page_ua('/partenaires', 'WhatsApp/2.23.20.0 A')
    verifier('/partenaires : aperçu « Devenir partenaire de KongoX »', 'property="og:title" content="Devenir partenaire de KongoX"' in h.split('</head>')[0])

    # ---------------- Admin
    d = rpc_j('envoyer_demande_partenaire', u1, {'p_nom': 'Test KongoX Radio', 'p_organisation': 'Radio Test', 'p_type': 'media', 'p_contact': '+243 81 555 0000', 'p_message': 'Nous voulons citer vos pourcentages.'})
    s, h = page('/admin/partenaires', adm)
    verifier('Admin › Partenaires : demande affichée avec contact WhatsApp', s == 200 and 'Test KongoX Radio' in h and 'https://wa.me/243815550000' in h and 'Prendre en charge' in h, s)
    verifier('menu admin : entrée Partenaires avec compteur', re.search(r'Partenaires(?:<!-- -->)?<span[^>]*>\d+<', h) is not None)
    s, h = page('/admin/partenaires', u1)
    verifier('Admin › Partenaires refusé à un utilisateur', 'Test KongoX Radio' not in h)
    s, h = page(f'/admin/marches/{m}', adm)
    verifier('Admin › Marché : champ Sponsor', 'Sponsor (partenaire)' in h and 'value="Marque Test"' in h)
    s, h = page('/admin/cadeaux', adm)
    verifier('Admin › Cadeaux : gagnants proposés et champ sponsor', 'Gagnants proposés (classement)' in h and 'Sponsor (facultatif)' in h and 'Semaine en cours' in h)
    rpc_j('creer_cadeau', adm, {'p_nom_utilisateur': u1['nom'], 'p_type': 'credit', 'p_description': 'Top 1 test', 'p_sponsor': 'Opérateur Test'})
    s, h = page('/profil', u1)
    verifier('profil : cadeau gagné, demande d\'ajouter le numéro', 'Bravo, tu as gagné un cadeau' in h and 'offert par Opérateur Test' in h and "L&#x27;équipe va te l&#x27;envoyer bientôt" in h, s)
finally:
    sql("update public.reglages set texte = '' where cle = 'whatsapp_equipe'")
    sql("delete from public.demandes_partenaires where nom like 'Test KongoX%'")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
