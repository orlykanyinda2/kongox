import json, sys, random, base64, datetime, subprocess, os, urllib.request, urllib.error

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
            return rep.status, rep.read().decode('utf-8-sig'), dict(rep.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)


def api(chemin, jeton, corps):
    s, t, _ = req('POST', U + chemin, {'apikey': A, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jeton}, corps)
    return s, (json.loads(t) if t else None)


def sql(requete):
    r = subprocess.run(['node', os.path.join(PG, 'sql.cjs'), '-e', requete], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr)


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
    s, d, _ = req('POST', U + '/auth/v1/admin/users', hs, {'email': nom.lower() + '@kongox.local', 'password': mdp, 'email_confirm': True, 'user_metadata': {'nom_utilisateur': nom}})
    uid = json.loads(d)['id']
    s, d, _ = req('POST', U + '/auth/v1/token?grant_type=password', {'apikey': A, 'Content-Type': 'application/json'}, {'email': nom.lower() + '@kongox.local', 'password': mdp})
    session = json.loads(d)
    valeur = 'base64-' + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip('=')
    nomc = f'sb-{REF}-auth-token'
    morceaux = [valeur[i:i + 3180] for i in range(0, len(valeur), 3180)]
    cookie = f'{nomc}={valeur}' if len(morceaux) == 1 else '; '.join(f'{nomc}.{i}={m}' for i, m in enumerate(morceaux))
    comptes[etiquette] = {'id': uid, 'nom': nom, 'jeton': session['access_token'], 'cookie': cookie}
    return comptes[etiquette]


def page(chemin, c=None):
    s, h, en = req('GET', SITE + chemin, {'Cookie': c['cookie']} if c else {})
    return s, h, en


INTROUVABLE = 'Page introuvable.'
try:
    adm, cur, util = creer('Adm'), creer('Cur'), creer('Util')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    s, cand = api('/rest/v1/rpc/postuler_curateur', cur['jeton'], {'p_categorie': 'football', 'p_motivation': 'Motivation de test assez longue ici.'})
    api('/rest/v1/rpc/traiter_candidature', adm['jeton'], {'p_candidature': cand, 'p_accepter': True})
    fin = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=5)).isoformat()
    s, q1 = api('/rest/v1/rpc/proposer_marche', util['jeton'], {'p_question': 'Test KongoX : question football à approuver ?', 'p_categorie': 'football', 'p_date_fin': fin, 'p_source': 'Test'})
    s, m_bo = api('/rest/v1/rpc/creer_marche_admin', adm['jeton'], {'p_question': 'Test KongoX : marché programmé du back-office ?', 'p_categorie': 'politique', 'p_source': 'Test',
                                                                    'p_date_fin': fin, 'p_etat': 'programme', 'p_date_publication': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat()})
    api('/rest/v1/rpc/ajuster_pieces', adm['jeton'], {'p_utilisateur': util['id'], 'p_montant': 250, 'p_raison': 'Test ajustement'})

    pages = {
        '/admin': ['Tableau de bord', 'Nouveaux inscrits', 'Comptes actifs', 'Pièces misées', 'Voir le tableau des valeurs', 'Fichier'],
        '/admin?periode=30': ['30 jours'],
        '/admin/marches': ['Nouveau marché', 'Exporter en CSV', 'marché programmé du back-office', 'Programmé'],
        '/admin/marches/nouveau': ['Créer le marché', 'Programmer à une date'],
        f'/admin/marches/{m_bo}': ['Publier maintenant', 'Repasser en brouillon', 'Dupliquer', 'Supprimer', 'Cagnotte', 'Historique'],
        '/admin/programmation': ['Brouillons et marchés programmés', 'marché programmé du back-office', 'Marchés récurrents'],
        '/admin/programmation?vue=calendrier': ['Mois suivant', 'lundi'],
        '/admin/approbation': ['question football à approuver', 'Approuver', 'Modifier le texte'],
        '/admin/resultats': ['Résultats à régler'],
        '/admin/utilisateurs?q=Test_Util': [util['nom'], 'Générer un mot de passe temporaire', 'Exporter en CSV'],
        f"/admin/utilisateurs/{util['id']}": ['Suspendre le compte', 'Ajuster les pièces', 'Prédictions récentes', 'Ajustement admin : Test ajustement'],
        '/admin/pieces': ['Ajuster un compte', 'Bonus en masse', 'Test ajustement', 'Historique des ajustements'],
        '/admin/cadeaux': ['Marquer un gagnant'],
        '/admin/curateurs': [cur['nom'], 'Essai'],
        '/admin/journal': ['Journal', 'Pièces ajustées', 'Marché créé', 'Candidature curateur acceptée'],
        '/admin/reglages': ['Pièces offertes à l', 'Limite de pièces misées par jour', 'Numéro WhatsApp'],
        '/admin/recherche?q=Test_Util': [util['nom']],
        '/admin/signalements': ['Signalements ouverts', 'Mots interdits'],
    }
    for chemin, attendus in pages.items():
        s, h, _ = page(chemin, adm)
        manquants = [x for x in attendus if x not in h and x != 'Fichier']
        verifier(f'admin {chemin}', s == 200 and not manquants, (s, manquants))
    s, h, _ = page('/admin', adm)
    verifier('style admin : pas de police de titre ludique ni d\'ombre décalée dans le contenu', 'shadow-decale' not in h and 'animate-' not in h.split('<main')[-1])

    # Export CSV
    for t in ['marches', 'utilisateurs', 'journal', 'ajustements']:
        s, h, en = page(f'/admin/export/{t}', adm)
        verifier(f'export CSV {t}', s == 200 and 'text/csv' in {k.lower(): v for k, v in en.items()}.get('content-type', '') and ';' in h.splitlines()[0], (s, en.get('Content-Type'), h[:80]))
    s, h, _ = page('/admin/export/journal', util)
    verifier('export CSV refusé à un utilisateur', s == 403, s)

    # Curateur et utilisateur
    s, h, _ = page('/admin', cur)
    verifier('curateur : /admin renvoie vers la file d\'approbation', 'NEXT_REDIRECT' in h and '/admin/approbation' in h, s)
    s, h, _ = page('/admin/approbation', cur)
    verifier('curateur : voit la file (son thème) avec « Proposer d\'approuver »', 'question football à approuver' in h and ('Proposer d&#x27;approuver' in h or "Proposer d'approuver" in h))
    s, h, _ = page('/admin/marches', cur)
    verifier('curateur : /admin/marches introuvable', INTROUVABLE in h)
    s, h, _ = page('/admin/reglages', util)
    verifier('utilisateur : /admin/reglages introuvable', INTROUVABLE in h)

    # Textes publics réglés
    for chemin in ['/', '/inscription', f'/marches/{q1}']:
        s, h, _ = page(chemin, util)
        import re as _re
        verifier(f'aucun marqueur [[…]] dans {chemin}', not _re.search(r'\[\[[a-z_]+\]\]', h), _re.findall(r'\[\[[a-z_]+\]\]', h)[:3])
    s, h, _ = page('/inscription')
    verifier('« 1 000 pièces offertes » vient du réglage', '1 000 pièces offertes' in h)
finally:
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    print('nettoyage fait')
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
