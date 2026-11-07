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


def hint(r):
    return r.get('hint') if isinstance(r, dict) else None


def demande(c=None, **k):
    corps = dict({'p_nom': 'Test KongoX Marque', 'p_organisation': 'Test SARL', 'p_type': 'marque', 'p_contact': '+243 81 234 5678',
                  'p_message': 'Nous voulons sponsoriser une question.'}, **k)
    if c:
        return rpc('envoyer_demande_partenaire', c, corps)
    return req('POST', '/rest/v1/rpc/envoyer_demande_partenaire', A, None, corps)


try:
    adm, u1, u2, u3 = creer('Adm'), creer('U1'), creer('U2'), creer('U3')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")

    # ---------------- Demandes de partenariat
    s, r = demande()
    verifier('visiteur : demande de partenariat enregistrée', s == 200 and isinstance(r, int), (s, r))
    d1 = r
    s, r = demande(u1, p_contact='test.kongox@exemple.com', p_type='sponsor_cadeaux')
    verifier('connecté : demande avec e-mail, liée au compte', s == 200 and sql(f"select utilisateur_id from public.demandes_partenaires where id = {r}")[0]['utilisateur_id'] == u1['id'], (s, r))
    s, r = demande(p_contact='pas un contact')
    verifier('contact invalide refusé', hint(r) == 'contact_invalide', (s, r))
    s, r = demande(p_type='casino')
    verifier('type invalide refusé', hint(r) == 'demande_invalide', (s, r))
    s, r = demande(p_message='court')
    verifier('message trop court refusé', hint(r) == 'demande_invalide', (s, r))
    demande(p_contact='+243 99 000 0001'); demande(p_contact='+243 99 000 0001'); demande(p_contact='+243 99 000 0001')
    s, r = demande(p_contact='+243 99 000 0001')
    verifier('3 demandes par jour au maximum pour un même contact', hint(r) == 'demande_limite', (s, r))
    s, r = req('GET', '/rest/v1/demandes_partenaires?select=id', A, u1['jeton'])
    verifier('demandes invisibles pour un utilisateur (même la sienne)', s == 200 and r == [], (s, r))
    s, r = req('GET', '/rest/v1/demandes_partenaires?select=id', A)
    verifier('demandes invisibles pour un visiteur', s >= 400 or r == [], (s, r))
    s, r = req('GET', '/rest/v1/demandes_partenaires?select=id,contact', A, adm['jeton'])
    verifier('admin : voit les demandes et le contact', s == 200 and any(x['id'] == d1 for x in r), (s, len(r) if isinstance(r, list) else r))
    s, r = rpc('traiter_demande_partenaire', u1, {'p_demande': d1, 'p_statut': 'traitee'})
    verifier('traiter une demande : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('traiter_demande_partenaire', adm, {'p_demande': d1, 'p_statut': 'en_cours', 'p_note': 'Rendez-vous lundi'})
    x = sql(f"select statut, note from public.demandes_partenaires where id = {d1}")[0]
    verifier('admin : demande prise en charge avec une note (journalisé)', x == {'statut': 'en_cours', 'note': 'Rendez-vous lundi'}
             and len(sql(f"select 1 from public.journal_admin where action = 'demande_partenaire_en_cours' and auteur_id = '{adm['id']}'")) == 1, x)
    rpc('traiter_demande_partenaire', adm, {'p_demande': d1, 'p_statut': 'traitee'})
    verifier('changer de statut garde la note', sql(f"select statut, note from public.demandes_partenaires where id = {d1}")[0] == {'statut': 'traitee', 'note': 'Rendez-vous lundi'})
    s, r = rpc('traiter_demande_partenaire', adm, {'p_demande': d1, 'p_statut': 'n_importe'})
    verifier('statut inconnu refusé', hint(r) == 'statut_invalide', (s, r))
    s, r = req('POST', '/rest/v1/demandes_partenaires', A, None, {'nom': 'x', 'type': 'marque', 'contact': 'x', 'message': 'x'})
    verifier('aucune écriture directe dans demandes_partenaires', s >= 400, s)

    # ---------------- Sponsor d'un marché
    m = marche('le sponsor apparaît-il bien ?', 'vie_quotidienne', 1)
    miser(u1, m, True, 50)
    s, r = rpc('definir_sponsor_marche', u1, {'p_marche': m, 'p_sponsor': 'Marque Test'})
    verifier('sponsor : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('definir_sponsor_marche', adm, {'p_marche': m, 'p_sponsor': '  Marque Test  '})
    verifier('admin : sponsor défini même après des mises (journalisé)', sql(f"select sponsor from public.marches where id = {m}")[0]['sponsor'] == 'Marque Test'
             and len(sql(f"select 1 from public.journal_admin where action = 'sponsor_marche' and cible_marche = {m}")) == 1, (s, r))
    s, r = rpc('definir_sponsor_marche', adm, {'p_marche': m, 'p_sponsor': 'x'})
    verifier('nom de sponsor trop court refusé', hint(r) == 'hors_limites', (s, r))
    rpc('definir_sponsor_marche', adm, {'p_marche': m, 'p_sponsor': ''})
    verifier('sponsor retiré (vide)', sql(f"select sponsor from public.marches where id = {m}")[0]['sponsor'] is None)
    rpc('definir_sponsor_marche', adm, {'p_marche': m, 'p_sponsor': 'Marque Test'})

    # ---------------- Cadeaux
    s, r = rpc('creer_cadeau', adm, {'p_nom_utilisateur': '@' + u1['nom'], 'p_type': 'credit', 'p_description': 'Top 1 de la semaine', 'p_sponsor': 'Opérateur Test'})
    verifier('cadeau avec sponsor (nom avec @ accepté)', s == 200 and sql(f"select sponsor from public.cadeaux where id = {r}")[0]['sponsor'] == 'Opérateur Test', (s, r))
    c1 = r
    s, r = rpc('creer_cadeau', adm, {'p_nom_utilisateur': u2['nom'], 'p_type': 'forfait_internet', 'p_description': 'Top 2'})
    verifier('cadeau sans sponsor (ancien appel à 3 paramètres)', s == 200, (s, r))
    c2 = r
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': c1})
    verifier('envoi refusé sans numéro', hint(r) == 'numero_manquant', (s, r))
    sql(f"insert into public.coordonnees_utilisateurs (utilisateur_id, telephone) values ('{u1['id']}', '+243810000777') on conflict (utilisateur_id) do update set telephone = excluded.telephone")
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': c1})
    verifier('cadeau envoyé (numéro gardé)', s in (200, 204) and sql(f"select statut, telephone from public.cadeaux where id = {c1}")[0] == {'statut': 'envoye', 'telephone': '+243810000777'}, (s, r))
    # u1 change de numéro, u2 prend l'ancien numéro de u1 : un cadeau par numéro
    sql(f"update public.coordonnees_utilisateurs set telephone = '+243810000778' where utilisateur_id = '{u1['id']}'")
    sql(f"insert into public.coordonnees_utilisateurs (utilisateur_id, telephone) values ('{u2['id']}', '+243810000777') on conflict (utilisateur_id) do update set telephone = excluded.telephone")
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': c2})
    verifier('un cadeau par numéro : numéro déjà récompensé pour un autre compte refusé', hint(r) == 'numero_deja_recompense', (s, r))
    s, r = rpc('creer_cadeau', adm, {'p_nom_utilisateur': u1['nom'], 'p_type': 'credit', 'p_description': 'Top 1 encore'})
    sql(f"update public.coordonnees_utilisateurs set telephone = '+243810000999' where utilisateur_id = '{u2['id']}'")
    sql(f"update public.coordonnees_utilisateurs set telephone = '+243810000777' where utilisateur_id = '{u1['id']}'")
    s2, r2 = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': r})
    verifier('le même compte peut recevoir un 2e cadeau sur son numéro', s2 in (200, 204), (s2, r2))
    s, r = rpc('marquer_cadeau_envoye', adm, {'p_cadeau': c2})
    verifier('nouveau numéro jamais récompensé : envoi accepté', s in (200, 204), (s, r))

    s, r = req('POST', '/rest/v1/rpc/derniers_gagnants', A, None, {'p_limite': 50})
    noms = [x['nom_utilisateur'] for x in r] if s == 200 else []
    verifier('derniers gagnants publics (visiteur) : noms et sponsor', s == 200 and u1['nom'] in noms and any(x.get('sponsor') == 'Opérateur Test' for x in r), (s, r))
    verifier('derniers gagnants : jamais le numéro', s == 200 and all('telephone' not in x for x in r) and '+243' not in json.dumps(r))
    s, r = req('GET', f"/rest/v1/cadeaux?select=id,telephone&utilisateur_id=eq.{u1['id']}", A, u2['jeton'])
    verifier('cadeaux des autres invisibles', s == 200 and r == [], (s, r))
    s, r = req('GET', '/rest/v1/cadeaux?select=id,sponsor,statut', A, u1['jeton'])
    verifier('le gagnant voit ses cadeaux', s == 200 and len(r) == 2, (s, r))
finally:
    sql("delete from public.demandes_partenaires where nom like 'Test KongoX%' or contact in ('+243 99 000 0001', 'test.kongox@exemple.com')")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
