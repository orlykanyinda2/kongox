import json, sys, random, datetime, subprocess, os, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
PG = sys.argv[2]


def req(methode, chemin, cle, jeton=None, corps=None, entetes=None):
    h = {'apikey': cle, 'Content-Type': 'application/json'}
    if jeton or not cle.startswith('sb_'):
        h['Authorization'] = 'Bearer ' + (jeton or cle)
    h.update(entetes or {})
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
    return json.loads(lignes[0]) if lignes else []


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


fin = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)).isoformat()
n = [0]


def proposer(c, categorie='football'):
    n[0] += 1
    s, r = rpc('proposer_marche', c, {'p_question': 'Test KongoX : la question numéro %d de l\'essai sera-t-elle validée ?' % n[0],
                                      'p_categorie': categorie, 'p_date_fin': fin, 'p_source': 'Test automatique'})
    assert s == 200, (s, r)
    return r


try:
    adm, cur, aut, autre = creer('Adm'), creer('Cur'), creer('Aut'), creer('Autre')
    req('PATCH', f"/rest/v1/utilisateurs?id=eq.{adm['id']}", S, corps={'role': 'admin'})

    # --- Candidature curateur
    s, r = rpc('postuler_curateur', cur, {'p_categorie': 'football', 'p_motivation': 'trop court'})
    verifier('motivation trop courte refusée', s >= 400 and r.get('hint') == 'motivation_invalide', (s, r))
    s, cand = rpc('postuler_curateur', cur, {'p_categorie': 'football', 'p_motivation': 'Je suis le foot congolais depuis 10 ans, je connais la Linafoot.'})
    verifier('candidature envoyée', s == 200, (s, cand))
    s, r = rpc('postuler_curateur', cur, {'p_categorie': 'football', 'p_motivation': 'Je suis le foot congolais depuis 10 ans, je connais la Linafoot.'})
    verifier('deuxième candidature identique refusée', s >= 400 and r.get('hint') == 'candidature_en_attente', (s, r))
    s, r = rpc('traiter_candidature', cur, {'p_candidature': cand, 'p_accepter': True})
    verifier('un non-admin ne peut pas accepter', s >= 400, (s, r))
    s, r = rpc('traiter_candidature', adm, {'p_candidature': cand, 'p_accepter': True})
    verifier('l\'admin accepte la candidature', s in (200, 204), (s, r))
    s, r = req('GET', f"/rest/v1/utilisateurs?id=eq.{cur['id']}&select=role,badges", S)
    verifier('rôle curateur + badge « Curateur Football »', r[0]['role'] == 'curateur' and 'Curateur Football' in r[0]['badges'], r)
    s, r = req('GET', f"/rest/v1/curateurs?utilisateur_id=eq.{cur['id']}&select=statut,categorie", A)
    verifier('curateur en période d\'essai (football)', r == [{'statut': 'essai', 'categorie': 'football'}], r)

    # --- Visibilité de la file
    m_foot = proposer(aut, 'football')
    m_musique = proposer(aut, 'musique')
    s, r = req('GET', f'/rest/v1/marches?id=in.({m_foot},{m_musique})&select=id', A, cur['jeton'])
    verifier('le curateur voit la question en attente de son thème seulement', [x['id'] for x in r] == [m_foot], r)
    s, r = req('GET', f'/rest/v1/marches?id=in.({m_foot},{m_musique})&select=id', A, autre['jeton'])
    verifier('un simple utilisateur ne voit pas les questions en attente des autres', r == [], r)

    # --- Décision en essai
    s, r = rpc('approuver_marche', cur, {'p_marche': m_musique})
    verifier('curateur football : ne peut pas décider en musique', s >= 400 and r.get('hint') == 'reserve_admin', (s, r))
    s, r = rpc('approuver_marche', cur, {'p_marche': m_foot})
    verifier('curateur en essai : approbation « en_validation »', s == 200 and r == 'en_validation', (s, r))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_foot}&select=statut', S)
    verifier('le marché reste en attente', r == [{'statut': 'en_attente'}], r)
    s, r = rpc('approuver_marche', cur, {'p_marche': m_foot})
    verifier('deuxième décision sur le même marché refusée', s >= 400 and r.get('hint') == 'decision_en_attente', (s, r))
    s, d = req('GET', f'/rest/v1/decisions_curateur?marche_id=eq.{m_foot}&select=id,statut', A, adm['jeton'])
    verifier('l\'admin voit la décision à valider', len(d) == 1 and d[0]['statut'] == 'a_valider', d)
    s, r = req('GET', f'/rest/v1/decisions_curateur?select=id', A, autre['jeton'])
    verifier('un utilisateur ne voit pas les décisions', r == [], r)
    s, r = rpc('valider_decision_curateur', adm, {'p_decision': d[0]['id'], 'p_accepter': True})
    verifier('l\'admin valide la décision', s in (200, 204), (s, r))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_foot}&select=statut', S)
    verifier('marché approuvé après validation', r == [{'statut': 'approuve'}], r)
    s, r = req('GET', f"/rest/v1/utilisateurs?id=eq.{aut['id']}&select=solde_pieces,badges", S)
    verifier('auteur : +50 pièces et badge', r[0]['solde_pieces'] == 1050 and 'Créateur de marché' in r[0]['badges'], r)
    s, r = req('GET', f"/rest/v1/curateurs?utilisateur_id=eq.{cur['id']}&select=decisions_validees", A)
    verifier('1 décision validée', r[0]['decisions_validees'] == 1, r)

    # --- Refus en essai puis admin qui décide autrement → décision annulée
    m2 = proposer(aut, 'football')
    rpc('refuser_marche', cur, {'p_marche': m2, 'p_motif': 'Pas clair'})
    s, r = rpc('approuver_marche', adm, {'p_marche': m2})
    verifier('l\'admin approuve directement', s == 200 and r == 'approuve', (s, r))
    s, r = req('GET', f'/rest/v1/decisions_curateur?marche_id=eq.{m2}&select=statut', S)
    verifier('la décision contraire du curateur est annulée', r == [{'statut': 'annulee'}], r)
    s, r = req('GET', f"/rest/v1/curateurs?utilisateur_id=eq.{cur['id']}&select=decisions_validees", A)
    verifier('toujours 1 décision validée', r[0]['decisions_validees'] == 1, r)

    # --- Sortie d'essai : 9 décisions de plus validées → autonome
    for _ in range(9):
        m = proposer(aut, 'football')
        rpc('approuver_marche', cur, {'p_marche': m})
        rpc('approuver_marche', adm, {'p_marche': m})
    s, r = req('GET', f"/rest/v1/curateurs?utilisateur_id=eq.{cur['id']}&select=statut,decisions_validees", A)
    verifier('10 décisions validées → curateur autonome', r[0] == {'statut': 'autonome', 'decisions_validees': 10}, r)
    m3 = proposer(aut, 'football')
    s, r = rpc('refuser_marche', cur, {'p_marche': m3, 'p_motif': 'Vise un particulier'})
    verifier('curateur autonome : refus appliqué directement', s == 200 and r == 'refuse', (s, r))

    # --- Modifier le texte
    m4 = proposer(aut, 'football')
    s, r = rpc('modifier_marche', cur, {'p_marche': m4, 'p_question': 'Test KongoX : texte corrigé par le curateur ?', 'p_categorie': 'musique', 'p_date_fin': fin, 'p_source': 'Source corrigée'})
    verifier('curateur football : ne peut pas déplacer en musique', s >= 400, (s, r))
    s, r = rpc('modifier_marche', cur, {'p_marche': m4, 'p_question': 'Test KongoX : texte corrigé par le curateur ?', 'p_categorie': 'football', 'p_date_fin': fin, 'p_source': 'Source corrigée'})
    verifier('curateur : modifie le texte', s in (200, 204), (s, r))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m4}&select=question,source', S)
    verifier('texte modifié', r[0]['source'] == 'Source corrigée', r)

    # --- Soki du jour
    s, r = rpc('definir_soki_du_jour', adm, {'p_marche': m_foot})
    s2, r2 = req('GET', '/rest/v1/marches?soki_du_jour=eq.true&select=id', S)
    verifier('un seul Soki du jour', s in (200, 204) and r2 == [{'id': m_foot}], (s, r, r2))

    # --- Rôles
    s, r = rpc('changer_role', adm, {'p_utilisateur': adm['id'], 'p_role': 'utilisateur'})
    verifier('un admin ne peut pas se retirer son rôle', s >= 400 and r.get('hint') == 'soi_meme', (s, r))
    s, r = rpc('changer_role', autre, {'p_utilisateur': autre['id'], 'p_role': 'admin'})
    verifier('un utilisateur ne peut pas se nommer admin', s >= 400, (s, r))
    s, r = rpc('changer_statut_curateur', adm, {'p_utilisateur': cur['id'], 'p_categorie': 'football', 'p_statut': 'retirer'})
    s2, r2 = req('GET', f"/rest/v1/utilisateurs?id=eq.{cur['id']}&select=role,badges", S)
    verifier('curateur retiré : rôle utilisateur, badge enlevé', r2[0]['role'] == 'utilisateur' and 'Curateur Football' not in r2[0]['badges'], r2)

    # --- Cadeaux
    s, cad = rpc('creer_cadeau', adm, {'p_nom_utilisateur': autre['nom'].upper(), 'p_type': 'credit', 'p_description': 'Top 3 de la semaine'})
    verifier('cadeau créé (nom sans tenir compte des majuscules)', s == 200, (s, cad))
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': cad})
    verifier('envoi impossible sans numéro', s >= 400 and r.get('hint') == 'numero_manquant', (s, r))
    req('PATCH', f"/rest/v1/coordonnees_utilisateurs?utilisateur_id=eq.{autre['id']}", A, autre['jeton'], {'telephone': '+243991112233'})
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': cad})
    s2, r2 = req('GET', f'/rest/v1/cadeaux?id=eq.{cad}&select=statut,telephone', A, autre['jeton'])
    verifier('cadeau envoyé, numéro gardé ; le gagnant le voit', s in (200, 204) and r2 == [{'statut': 'envoye', 'telephone': '+243991112233'}], (s, r, r2))
    s, r = req('GET', '/rest/v1/cadeaux?select=id', A, aut['jeton'])
    verifier('un autre utilisateur ne voit pas ce cadeau', r == [], r)
    s, r = rpc('creer_cadeau', autre, {'p_nom_utilisateur': autre['nom'], 'p_type': 'credit', 'p_description': 'x'})
    verifier('un utilisateur ne peut pas se créer un cadeau', s >= 400, (s, r))

    # --- Accès admin aux données privées
    s, r = req('GET', f"/rest/v1/coordonnees_utilisateurs?utilisateur_id=eq.{autre['id']}&select=telephone", A, adm['jeton'])
    verifier('l\'admin lit le numéro (pour les cadeaux)', r == [{'telephone': '+243991112233'}], r)
    s, r = req('GET', f"/rest/v1/coordonnees_utilisateurs?utilisateur_id=eq.{autre['id']}&select=telephone", A, aut['jeton'])
    verifier('un utilisateur ne lit pas le numéro d\'un autre', r == [], r)
    s, r = rpc('statistiques_admin', adm, {})
    verifier('statistiques du tableau de bord', s == 200 and 'en_attente' in r and 'delai_moyen_h' in r, (s, r))
    s, r = rpc('statistiques_admin', autre, {})
    verifier('statistiques refusées à un utilisateur', s >= 400, (s, r))
    s, r = req('GET', '/rest/v1/journal_admin?select=action&order=id.desc&limit=50', A, adm['jeton'])
    actions = {x['action'] for x in r}
    verifier('journal : approbations, refus, cadeaux, curateur', {'marche_approuve', 'marche_refuse', 'cadeau_envoye', 'candidature_acceptee', 'curateur_retirer'} <= actions, actions)
    s, r = req('GET', '/rest/v1/journal_admin?select=id', A, autre['jeton'])
    verifier('journal invisible pour un utilisateur', r == [], r)
finally:
    ids = ','.join("'%s'" % x['id'] for x in comptes.values())
    if ids:
        sql(f"""begin;
          delete from public.journal_admin where auteur_id in ({ids}) or cible_utilisateur in ({ids});
          delete from auth.users where id in ({ids});
          update public.marches set option_gagnante_id = null where question like 'Test KongoX%';
          delete from public.decisions_curateur where marche_id in (select id from public.marches where question like 'Test KongoX%');
          delete from public.journal_admin where cible_marche in (select id from public.marches where question like 'Test KongoX%');
          delete from public.options_marche where marche_id in (select id from public.marches where question like 'Test KongoX%');
          delete from public.marches where question like 'Test KongoX%';
          update public.marches set soki_du_jour = (question = 'Les Léopards vont-ils se qualifier pour la CAN 2027 ?');
          commit;""")
    r = sql("select (select count(*) from public.utilisateurs where nom_utilisateur like 'Test\\_%') as comptes, (select count(*) from public.marches) as marches, (select count(*) from public.marches where soki_du_jour) as soki")
    print('nettoyage :', r)
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
