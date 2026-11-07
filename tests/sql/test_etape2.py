import json, sys, random, datetime, subprocess, os, urllib.request, urllib.error

env = {}
for l in open(sys.argv[1], encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1)
        env[k] = v.strip()
U, A, S = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
PG = sys.argv[2]  # dossier du client pg (sql.cjs)


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
    comptes[etiquette] = {'id': uid, 'jeton': d['access_token']}
    return comptes[etiquette]


def solde(c):
    return req('GET', f"/rest/v1/utilisateurs?id=eq.{c['id']}&select=solde_pieces", S)[1][0]['solde_pieces']


def rpc(nom, c, corps):
    return req('POST', f'/rest/v1/rpc/{nom}', A, c['jeton'] if c else None, corps)


marches_test = []
try:
    adm, b, c, d = creer('Adm'), creer('B'), creer('C'), creer('D')
    req('PATCH', f"/rest/v1/utilisateurs?id=eq.{adm['id']}", S, corps={'role': 'admin'})

    # --- Marché d'exemple (seed) et options
    s, m = req('GET', '/rest/v1/marches?select=id,question,options_marche!options_marche_marche_id_fkey(id,libelle,total_mise)&soki_du_jour=eq.true', A)
    verifier('marché « Soki du jour » visible sans connexion', s == 200 and len(m) == 1, (s, m))
    soki = m[0]
    oui = next(o for o in soki['options_marche'] if o['libelle'] == 'OUI')
    non = next(o for o in soki['options_marche'] if o['libelle'] == 'NON')
    total_oui0, total_non0 = oui['total_mise'], non['total_mise']

    # --- Mises
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 300})
    verifier('B mise 300 sur OUI', s == 200 and r['solde'] == 700 and r['restant_aujourdhui'] == 1700, (s, r))
    s, r = rpc('placer_prediction', c, {'p_marche': soki['id'], 'p_option': non['id'], 'p_montant': 200})
    verifier('C mise 200 sur NON', s == 200 and r['solde'] == 800, (s, r))
    s, m = req('GET', f"/rest/v1/options_marche?marche_id=eq.{soki['id']}&select=libelle,total_mise&order=ordre", A)
    verifier('cagnottes mises à jour (+300 OUI, +200 NON)', m[0]['total_mise'] == total_oui0 + 300 and m[1]['total_mise'] == total_non0 + 200, m)
    s, r = rpc('placer_prediction', None, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 100})
    verifier('mise sans connexion refusée', s >= 400, (s, r))
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 5})
    verifier('mise de moins de 10 pièces refusée', s >= 400 and r.get('hint') == 'montant_invalide', (s, r))
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': 999999999, 'p_montant': 50})
    verifier('option d\'un autre marché refusée', s >= 400 and r.get('hint') == 'option_invalide', (s, r))
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 800})
    verifier('solde insuffisant refusé', s >= 400 and r.get('hint') == 'solde_insuffisant', (s, r))

    # --- Limite de 2 000 par jour (on donne des pièces à B par la base pour le test)
    sql(f"select public.mouvement_pieces('{b['id']}', 5000, 'bonus_quotidien', 'Test : pièces pour la limite')")
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 1700})
    verifier('B mise encore 1 700 (total 2 000 : autorisé)', s == 200 and r['restant_aujourdhui'] == 0, (s, r))
    s, r = rpc('placer_prediction', b, {'p_marche': soki['id'], 'p_option': oui['id'], 'p_montant': 10})
    verifier('2 010 pièces dans la journée : refusé (limite)', s >= 400 and r.get('hint') == 'limite_quotidienne', (s, r))
    s, r = rpc('mise_restante_aujourdhui', b, {})
    verifier('mise restante = 0', r == 0, r)

    # --- Proposer une question
    fin = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)).isoformat()
    s, r = rpc('proposer_marche', d, {'p_question': 'Test KongoX : la question numéro un sera-t-elle réglée ?', 'p_categorie': 'vie_quotidienne', 'p_date_fin': fin, 'p_source': 'Test automatique'})
    verifier('D propose une question', s == 200 and isinstance(r, int), (s, r))
    m1 = r
    marches_test.append(m1)
    s, r = rpc('proposer_marche', d, {'p_question': 'Pas de point d interrogation', 'p_categorie': 'politique', 'p_date_fin': fin, 'p_source': 'Test'})
    verifier('question sans « ? » refusée', s >= 400 and r.get('hint') == 'question_invalide', (s, r))
    s, r = rpc('proposer_marche', d, {'p_question': 'Test KongoX : cette question finit-elle trop tôt ?', 'p_categorie': 'politique', 'p_date_fin': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'p_source': 'Test'})
    verifier('date de fin trop proche refusée', s >= 400 and r.get('hint') == 'date_invalide', (s, r))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m1}&select=statut', A)
    verifier('question en attente invisible pour le public', r == [], r)
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m1}&select=statut', A, d['jeton'])
    verifier('l\'auteur voit sa question en attente', r == [{'statut': 'en_attente'}], r)
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m1}&select=statut', A, adm['jeton'])
    verifier('l\'admin voit la question en attente', r == [{'statut': 'en_attente'}], r)
    s, r = rpc('placer_prediction', b, {'p_marche': m1, 'p_option': 1, 'p_montant': 50})
    verifier('miser sur une question en attente : refusé', s >= 400, (s, r))

    # --- Approbation
    s, r = rpc('approuver_marche', d, {'p_marche': m1})
    verifier('un non-admin ne peut pas approuver', s >= 400 and r.get('hint') == 'reserve_admin', (s, r))
    sd = solde(d)
    s, r = rpc('approuver_marche', adm, {'p_marche': m1})
    verifier('l\'admin approuve', s in (200, 204), (s, r))
    s, r = req('GET', f"/rest/v1/utilisateurs?id=eq.{d['id']}&select=solde_pieces,badges", S)
    verifier('auteur : +50 pièces et badge « Créateur de marché »', r[0]['solde_pieces'] == sd + 50 and 'Créateur de marché' in r[0]['badges'], r)
    s, r = rpc('approuver_marche', adm, {'p_marche': m1})
    verifier('approuver deux fois : refusé (pas de double bonus)', s >= 400, (s, r))

    # --- Règlement avec arrondi : OUI 100 (C) + 200 (D), NON 101 (adm) → cagnotte 401
    s, o = req('GET', f'/rest/v1/options_marche?marche_id=eq.{m1}&select=id,libelle&order=ordre', A)
    o_oui, o_non = o[0]['id'], o[1]['id']
    sc, sdd, sa = solde(c), solde(d), solde(adm)
    rpc('placer_prediction', c, {'p_marche': m1, 'p_option': o_oui, 'p_montant': 100})
    rpc('placer_prediction', d, {'p_marche': m1, 'p_option': o_oui, 'p_montant': 200})
    rpc('placer_prediction', adm, {'p_marche': m1, 'p_option': o_non, 'p_montant': 101})
    s, r = rpc('regler_marche', c, {'p_marche': m1, 'p_option_gagnante': o_oui, 'p_lien_resultat': 'https://exemple.cd'})
    verifier('un non-admin ne peut pas régler', s >= 400, (s, r))
    s, r = rpc('regler_marche', adm, {'p_marche': m1, 'p_option_gagnante': o_oui, 'p_lien_resultat': ''})
    verifier('règlement sans lien source refusé', s >= 400 and r.get('hint') == 'lien_obligatoire', (s, r))
    s, r = rpc('regler_marche', adm, {'p_marche': m1, 'p_option_gagnante': o_oui, 'p_lien_resultat': 'https://exemple.cd/resultat'})
    verifier('l\'admin règle le marché (OUI gagne)', s == 200 and r['cagnotte'] == 401 and r['gagnants'] == 2, (s, r))
    # C : 100*401/300 = 133,67 → 133 ; D : 200*401/300 = 267,33 → 267 ; reste 1 → C (plus grand reste)
    verifier('C gagne 134 (133 + 1 pièce de reste)', solde(c) == sc - 100 + 134, (sc, solde(c)))
    verifier('D gagne 267', solde(d) == sdd - 200 + 267, (sdd, solde(d)))
    verifier('l\'admin (NON) perd sa mise', solde(adm) == sa - 101, (sa, solde(adm)))
    s, r = req('GET', f'/rest/v1/predictions?marche_id=eq.{m1}&select=statut,gain', S)
    verifier('somme des gains = cagnotte (401)', sum(p['gain'] for p in r) == 401, r)
    s, r = rpc('regler_marche', adm, {'p_marche': m1, 'p_option_gagnante': o_oui, 'p_lien_resultat': 'https://exemple.cd'})
    verifier('régler deux fois : refusé', s >= 400, (s, r))
    s, r = rpc('placer_prediction', b, {'p_marche': m1, 'p_option': o_oui, 'p_montant': 10})
    verifier('miser sur un marché réglé : refusé', s >= 400, (s, r))

    # --- Personne sur la bonne réponse → remboursement ; annulation → remboursement
    s, m2 = rpc('proposer_marche', d, {'p_question': 'Test KongoX : personne ne gagnera-t-il ce marché ?', 'p_categorie': 'politique', 'p_date_fin': fin, 'p_source': 'Test automatique'})
    marches_test.append(m2)
    rpc('approuver_marche', adm, {'p_marche': m2})
    s, o = req('GET', f'/rest/v1/options_marche?marche_id=eq.{m2}&select=id&order=ordre', A)
    sc = solde(c)
    rpc('placer_prediction', c, {'p_marche': m2, 'p_option': o[0]['id'], 'p_montant': 150})
    s, r = rpc('regler_marche', adm, {'p_marche': m2, 'p_option_gagnante': o[1]['id'], 'p_lien_resultat': 'https://exemple.cd'})
    verifier('personne sur NON : tout le monde est remboursé', s == 200 and r['rembourse'] and solde(c) == sc, (s, r, sc, solde(c)))

    s, m3 = rpc('proposer_marche', d, {'p_question': 'Test KongoX : ce marché sera-t-il annulé par un admin ?', 'p_categorie': 'musique', 'p_date_fin': fin, 'p_source': 'Test automatique'})
    marches_test.append(m3)
    rpc('approuver_marche', adm, {'p_marche': m3})
    s, o = req('GET', f'/rest/v1/options_marche?marche_id=eq.{m3}&select=id&order=ordre', A)
    sc = solde(c)
    rpc('placer_prediction', c, {'p_marche': m3, 'p_option': o[1]['id'], 'p_montant': 120})
    s, r = rpc('annuler_marche', adm, {'p_marche': m3, 'p_motif': 'Test'})
    verifier('annulation : mise remboursée', s in (200, 204) and solde(c) == sc, (s, r, sc, solde(c)))

    # --- Graphique
    s, r = req('POST', '/rest/v1/rpc/historique_marche', A, None, {'p_marche': m1})
    verifier('historique du OUI (3 points, dernier = 74,8 %)', s == 200 and len(r) == 3 and float(r[-1]['pourcentage_oui']) == 74.8, (s, r))

    # --- Sécurité
    s, r = req('GET', '/rest/v1/predictions?select=*', A, c['jeton'])
    verifier('votes publics (feat/communaute) : C voit aussi les prédictions des autres', s == 200 and any(p['utilisateur_id'] == c['id'] for p in r) and any(p['utilisateur_id'] != c['id'] for p in r), (s, r))
    s, r = req('POST', '/rest/v1/marches', A, b['jeton'], {'question': 'Insertion directe interdite ?', 'categorie': 'politique', 'date_fin': fin, 'source': 'x', 'statut': 'approuve'})
    verifier('créer un marché sans passer par la fonction : refusé', s in (401, 403), (s, r))
    s, r = req('PATCH', f"/rest/v1/options_marche?id=eq.{oui['id']}", A, b['jeton'], {'total_mise': 999999})
    verifier('modifier une cagnotte : refusé', s in (401, 403), (s, r))
    s, r = req('POST', '/rest/v1/predictions', A, b['jeton'], {'utilisateur_id': b['id'], 'marche_id': soki['id'], 'option_id': oui['id'], 'montant': 10})
    verifier('créer une prédiction sans payer : refusé', s in (401, 403), (s, r))
    s, r = rpc('rembourser_marche', b, {'p_marche': soki['id'], 'p_question': 'x'})
    verifier('appeler rembourser_marche : refusé', s >= 400, (s, r))

    # --- Conservation : aucune pièce perdue ni doublée
    ids = ','.join("'%s'" % x['id'] for x in comptes.values())
    r = sql(f"""select
        (select coalesce(sum(solde_pieces),0) from public.utilisateurs where id in ({ids})) as soldes,
        (select coalesce(sum(montant),0) from public.predictions where utilisateur_id in ({ids}) and statut = 'en_cours') as en_jeu,
        (select coalesce(sum(montant),0) from public.transactions_pieces where utilisateur_id in ({ids})) as journal,
        (select coalesce(sum(total_mise),0) from public.options_marche where marche_id in ({','.join(map(str, marches_test))})) as cagnottes_test,
        (select coalesce(sum(gain),0) from public.predictions where marche_id in ({','.join(map(str, marches_test))})) as verse_test""")[0]
    verifier('soldes = somme du journal des pièces', int(r['soldes']) == int(r['journal']), r)
    verifier('cagnottes des marchés réglés entièrement reversées', int(r['cagnottes_test']) == int(r['verse_test']), r)
finally:
    # Nettoyage : mises de test sur le Soki, marchés de test, comptes de test
    ids = ','.join("'%s'" % x['id'] for x in comptes.values())
    if ids:
        # Ordre important : d'abord les comptes (leurs mises et leurs transactions partent avec eux),
        # puis les marchés de test. Supprimer un marché avant modifierait des transactions, ce qui est interdit.
        sql(f"""
          update public.options_marche o set total_mise = total_mise - coalesce((select sum(p.montant) from public.predictions p
                 where p.option_id = o.id and p.utilisateur_id in ({ids}) and p.statut = 'en_cours'), 0)
           where o.marche_id in (select marche_id from public.predictions where utilisateur_id in ({ids}));
          delete from public.journal_admin where auteur_id in ({ids}) or cible_utilisateur in ({ids});
          delete from auth.users where id in ({ids});
          update public.marches set option_gagnante_id = null where id in ({','.join(map(str, marches_test)) or '0'});
          delete from public.journal_admin where cible_marche in ({','.join(map(str, marches_test)) or '0'});
          delete from public.options_marche where marche_id in ({','.join(map(str, marches_test)) or '0'});
          delete from public.marches where id in ({','.join(map(str, marches_test)) or '0'});""")
    print('nettoyage : %d comptes et %d marchés de test supprimés' % (len(comptes), len(marches_test)))
    r = sql("select sum(total_mise) as total from public.options_marche")
    print('cagnottes restantes dans la base :', r)
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
