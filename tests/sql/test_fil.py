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


VISITEUR = 'eeeeeeee-0000-4000-8000-' + '%012d' % random.randint(0, 10**11)
ORIGINE = {r['cle']: r['valeur'] for r in sql("select cle, valeur from public.reglages_fil")}

try:
    adm, u1, u2, u3, u4 = creer('Adm'), creer('U1'), creer('U2'), creer('U3'), creer('U4')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")

    f1, f2, f3, f4 = (marche(f'football {i} va-t-il gagner ?', 'football', 1) for i in range(1, 5))
    m1 = marche('le concert de musique sera-t-il complet ?', 'musique', 30)
    p1 = marche('Équipe politique : le débat aura-t-il lieu ?', 'politique', 30)
    b1 = marche('ferme bientôt : il pleuvra ce soir ?', 'vie_quotidienne', 50, fin_dans_h=3)
    n1 = marche('tout nouveau marché : 50% de chances ?', 'vie_quotidienne', 0)

    for c in (u1, u2, u3):
        miser(c, f1, True, 100)
    miser(u1, f2, True, 200); miser(u2, f2, False, 100)
    miser(u1, f3, True, 50)
    miser(u2, f4, False, 50)
    miser(u1, m1, True, 100); miser(u2, m1, False, 100); miser(u3, m1, True, 100); miser(u4, m1, False, 100)
    miser(u1, p1, True, 10)

    # ---------------- Scores
    s, r = rpc('calculer_scores_fil', u1, {})
    verifier('calculer_scores_fil interdit aux utilisateurs', s >= 400, (s, r))
    s, r = req('POST', '/rest/v1/rpc/calculer_scores_fil', A, None, {})
    verifier('calculer_scores_fil interdit aux visiteurs', s >= 400, (s, r))
    n = sql("select public.calculer_scores_fil() as n")[0]['n']
    verifier('calcul des scores : une ligne par marché OUI/NON en ligne', n == int(sql("select count(*) as n from public.marches where statut = 'approuve' and type_reponse = 'oui_non' and date_fin > now()")[0]['n']), n)
    sc = sql(f"""select s.*, extract(epoch from now() - m.date_publication) / 3600 as heures from public.scores_marches s join public.marches m on m.id = s.marche_id
                 where marche_id = {f1}""")[0]
    attendu = (3 * 3 + 0 + 300 / 100) / (float(sc['heures']) + 2) ** 1.5 + 2
    verifier('score de tendance = formule de ALGORITHME.md (+ bonus nouveau, < 6 h)', abs(float(sc['score_tendance']) - attendu) < 0.01, (sc['score_tendance'], attendu))
    verifier('prédicteurs et pièces sur 24 h', sc['predicteurs_24h'] == 3 and int(sc['pieces_24h']) == 300, sc)
    sc_m = sql(f"select s.*, extract(epoch from now() - m.date_publication) / 3600 as heures from public.scores_marches s join public.marches m on m.id = s.marche_id where marche_id = {m1}")[0]
    attendu = (4 * 3 + 400 / 100) / (float(sc_m['heures']) + 2) ** 1.5
    verifier('marché de 30 h : pas de bonus nouveau', abs(float(sc_m['score_tendance']) - attendu) < 0.01, (sc_m['score_tendance'], attendu))
    verifier('controverse = (1 − |p − 0,5| × 2) × prédicteurs (50/50, 4 personnes → 4)', float(sc_m['controverse']) == 4.0, sc_m['controverse'])
    verifier('variation du OUI sur 24 h (100 % OUI depuis 50 % → +50 points)', float(sc['variation_oui_24h']) == 50.0, sc['variation_oui_24h'])
    verifier('momentum calculé (3 prédictions dans l\'heure)', sc['predictions_1h'] == 3 and float(sc['momentum']) > 0, sc)
    verifier('tâche pg_cron toutes les 10 minutes', sql("select schedule from cron.job where jobname = 'kongox-scores-fil'") == [{'schedule': '*/10 * * * *'}])
    verifier('purge des événements programmée', len(sql("select 1 from cron.job where jobname = 'kongox-purge-evenements'")) == 1)

    # ---------------- Sections
    sx = sections()
    tous = [i for v in sx.values() for i in v]
    verifier('pas de doublon entre les sections', len(tous) == len(set(tous)), sx)
    verifier('sections MVP seulement (phase 2 cachée)', set(sx) <= {'soki', 'tendances', 'bientot', 'nouveaux'}, list(sx))
    verifier('Tendances : 6 marchés au maximum', len(sx.get('tendances', [])) <= 6, sx.get('tendances'))
    cats = dict((int(r['id']), r['categorie']) for r in sql("select id, categorie from public.marches"))
    from collections import Counter
    verifier('diversité : au plus 2 marchés de la même catégorie dans Tendances', max(Counter(cats[i] for i in sx['tendances']).values()) <= 2, [cats[i] for i in sx['tendances']])
    verifier('les 4 marchés de foot (les plus actifs) ne sont pas tous en Tendances', sum(1 for i in (f1, f2, f3, f4) if i in sx['tendances']) == 2, sx['tendances'])
    verifier('Tendances : le plus actif (f1) en tête des non-épinglés', sx['tendances'][0] == f1 or sql(f"select mis_en_avant from public.marches where id = {sx['tendances'][0]}")[0]['mis_en_avant'], sx['tendances'])
    verifier('chaque marché en ligne est dans une section au plus', all(tous.count(i) <= 1 for i in (f1, f2, f3, f4, m1, p1, b1, n1)))
    soki = sql("select id from public.marches where soki_du_jour and statut = 'approuve' and date_fin > now()")
    if soki:
        verifier('Soki du jour en premier, absent des autres sections', sx.get('soki') == [int(soki[0]['id'])] and tous.count(int(soki[0]['id'])) == 1, sx)

    sql(f"update public.marches set mis_en_avant = true where id = {n1}")
    sx = sections()
    verifier('épinglé : en tête de Tendances', sx['tendances'][0] == n1, sx['tendances'])
    sql(f"update public.marches set mis_en_avant = false where id = {n1}")

    reglage('section_tendances', 0)
    sx = sections()
    verifier('Tendances cachée : absente', 'tendances' not in sx, list(sx))
    verifier('Bientôt fermés : fermeture < 24 h, du plus proche au plus lointain', b1 in sx.get('bientot', [])
             and all(r['ok'] for r in sql(f"select date_fin < now() + interval '24 hours' as ok from public.marches where id = any(array{sx['bientot']}::bigint[])"))
             and sx['bientot'] == [int(r['id']) for r in sql(f"select id from public.marches where id = any(array{sx['bientot']}::bigint[]) order by date_fin")], sx.get('bientot'))
    nv = sx.get('nouveaux', [])
    ordre = [int(r['id']) for r in sql(f"select id from public.marches where id = any(array{nv}::bigint[]) order by coalesce(date_publication, examine_le, cree_le) desc")] if nv else []
    verifier('Nouveaux : du plus récent au plus ancien (avec la diversité)', nv and nv[0] == n1, (nv, ordre))
    reglage('section_tendances', 1)
    reglage('section_nouveaux', 0)
    verifier('Nouveaux cachée : absente', 'nouveaux' not in sections())
    reglage('section_nouveaux', 1)

    # Phase 2
    reglage('section_divise', 1); reglage('controverse_min', 4)
    reglage('section_tendances', 0); reglage('section_bientot', 0)
    sx = sections()
    verifier('phase 2 « Le Congo est divisé » activée : le marché 50/50 à 4 personnes y est', m1 in sx.get('divise', []), sx)
    reglage('section_hausse', 1)
    sx = sections()
    hausse = sx.get('hausse', [])
    verifier('phase 2 « En forte hausse » : f1 (variation +50 points) y est', f1 in hausse, sx)
    verifier('« En forte hausse » passe avant « Le Congo est divisé » (pas de doublon)', not (set(hausse) & set(sx.get('divise', []))))
    for k in ('section_divise', 'section_hausse', 'controverse_min', 'section_tendances', 'section_bientot'):
        reglage(k, ORIGINE[k])

    s, r = rpc('fil_pour_toi', u1, {'p_exclure': []})
    verifier('« Pour toi » désactivée : vide', s == 200 and r == [], (s, r))
    reglage('section_pour_toi', 1)
    s, r = rpc('fil_pour_toi', u1, {'p_exclure': []})
    verifier('« Pour toi » : marchés de foot que u1 n\'a pas joués (f4), pas ceux déjà joués', s == 200 and f4 in r and f1 not in r and f2 not in r, (s, r))
    s, r = rpc('fil_pour_toi', u1, {'p_exclure': [f4]})
    verifier('« Pour toi » : exclut les marchés déjà montrés', s == 200 and f4 not in r, r)
    s, r = req('POST', '/rest/v1/rpc/fil_pour_toi', A, None, {'p_exclure': []})
    verifier('« Pour toi » réservé aux comptes connectés', s >= 400, s)
    reglage('section_pour_toi', 0)

    # ---------------- Recherche (/marches)
    def chercher(q='', cat=None, statut=None, tri=None, dec=0, lim=12, com=None):
        s, r = req('POST', '/rest/v1/rpc/rechercher_marches', A, None, {'p_recherche': q, 'p_categorie': cat, 'p_statut': statut, 'p_communaute': com,
                                                                       'p_tri': tri, 'p_decalage': dec, 'p_limite': lim})
        assert s == 200, (s, r)
        return r
    r = chercher('test kongox fil')
    verifier('recherche (visiteur) : les 8 marchés de test', len(r) == 8 and int(r[0]['total']) == 8, len(r))
    r = chercher('EQUIPE POLITIQUE')
    verifier('recherche sans accents ni majuscules (« equipe » → « Équipe »)', [int(x['id']) for x in r] == [p1], r)
    r = chercher('50%')
    verifier('« % » cherché tel quel (pas un joker)', [int(x['id']) for x in r] == [n1], [x['question'] for x in r])
    r = chercher('test kongox fil', cat='football')
    verifier('filtre catégorie', sorted(int(x['id']) for x in r) == sorted([f1, f2, f3, f4]), r)
    r = chercher('test kongox fil', tri='plus_mises')
    vol = [int(x['volume']) for x in r]
    verifier('tri « plus misés »', vol == sorted(vol, reverse=True) and int(r[0]['id']) == m1, vol)
    r = chercher('test kongox fil', tri='bientot')
    verifier('tri « bientôt fermés » : b1 en premier', int(r[0]['id']) == b1, r[0])
    r = chercher('test kongox fil', tri='nouveaux')
    verifier('tri « nouveaux » : n1 en premier', int(r[0]['id']) == n1, r[0])
    r = chercher('test kongox fil', tri='tendance')
    verifier('tri « tendance » : f1 avant m1 (score)', [int(x['id']) for x in r].index(f1) < [int(x['id']) for x in r].index(m1))
    chercher('', tri='plus_commentes')
    verifier('tri « plus commentés » accepté (0 commentaire avant le chat)', True)
    r = chercher('test kongox fil', statut='bientot')
    verifier('statut « ferment dans moins de 24 h »', [int(x['id']) for x in r] == [b1], r)
    p1a = chercher('test kongox fil', tri='nouveaux', dec=0, lim=3)
    p2a = chercher('test kongox fil', tri='nouveaux', dec=3, lim=3)
    verifier('pagination : pages sans recouvrement, total identique', len(p1a) == 3 and len(p2a) == 3 and not ({x['id'] for x in p1a} & {x['id'] for x in p2a})
             and p1a[0]['total'] == p2a[0]['total'] == 8)
    verifier('limite plafonnée à 48', len(chercher('', statut='tous', lim=1000)) <= 48)
    sql(f"update public.marches set statut = 'ferme' where id = {f4}")
    verifier('statut « fermés » / « en ligne »', [int(x['id']) for x in chercher('test kongox fil', statut='fermes')] == [f4]
             and f4 not in [int(x['id']) for x in chercher('test kongox fil')])
    sql(f"update public.marches set statut = 'approuve' where id = {f4}")
    sql(f"update public.marches set statut = 'en_attente' where id = {f3}")
    verifier('marché en attente : jamais montré', f3 not in [int(x['id']) for x in chercher('test kongox fil', statut='tous')] and f3 not in [i for v in sections().values() for i in v])
    sql(f"update public.marches set statut = 'approuve' where id = {f3}")

    # ---------------- Événements
    e = lambda **k: dict({'type': 'affiche', 'marche_id': f1, 'section': 'tendances', 'position': 1, 'page': '/', 'visiteur_id': VISITEUR, 'visite_id': str(uuid.uuid4())}, **k)
    s, r = rpc('enregistrer_evenements_fil', u1, {'p_evenements': [e()], 'p_utilisateur': u1['id']})
    verifier('enregistrer_evenements_fil interdit aux utilisateurs (serveur seulement)', s >= 400, (s, r))
    visite = str(uuid.uuid4())
    lot = [e(visite_id=visite) for _ in range(4)] + [e(type='clic', visite_id=visite), e(type='prediction', visite_id=visite),
           e(type='inconnu'), e(visiteur_id='pas-un-uuid'), e(visiteur_id='------------------------------------'), e(section='Mauvaise Section!'), e(marche_id=999999999)]
    s, r = rpc_service('enregistrer_evenements_fil', {'p_evenements': lot, 'p_utilisateur': None})
    verifier('lot d\'événements : 7 valides enregistrés, les invalides ignorés', s == 200 and r == 7, (s, r))
    verifier('marché inconnu : événement gardé sans marché', len(sql(f"select 1 from public.evenements_fil where visiteur_id = '{VISITEUR}' and marche_id is null")) == 1)
    s, r = rpc_service('enregistrer_evenements_fil', {'p_evenements': [e() for _ in range(80)], 'p_utilisateur': None})
    verifier('50 événements au maximum par lot', r == 50, r)
    s, r = req('GET', '/rest/v1/evenements_fil?select=id&limit=1', A, u1['jeton'])
    verifier('événements illisibles pour un utilisateur', s == 200 and r == [], (s, r))
    s, r = req('GET', '/rest/v1/evenements_fil?select=id&limit=1', A)
    verifier('événements illisibles pour un visiteur', s >= 400 or r == [], (s, r))
    # Retour J1 : premier jour il y a 3 jours, retour le lendemain
    sql(f"""insert into public.evenements_fil (cree_le, type, visiteur_id, visite_id) values
            (now() - interval '3 days', 'visite', 'eeeeeeee-0000-4000-8000-00000000000{random.randint(1,9)}', gen_random_uuid())""")
    v2 = 'eeeeeeee-0000-4000-8001-' + '%012d' % random.randint(0, 10**11)
    sql(f"""insert into public.evenements_fil (cree_le, type, visiteur_id, visite_id) values
            (now() - interval '3 days', 'visite', '{v2}', gen_random_uuid()), (now() - interval '2 days', 'visite', '{v2}', gen_random_uuid())""")
    s, r = rpc('indicateurs_fil', u1, {'p_jours': 7})
    verifier('indicateurs réservés aux admins', s >= 400, (s, r))
    s, r = rpc('indicateurs_fil', adm, {'p_jours': 7})
    t = next((x for x in r['sections'] if x['section'] == 'tendances'), None) if s == 200 else None
    verifier('indicateurs : affichages, clics, taux de clic de Tendances', t and t['affichages'] >= 54 and t['clics'] >= 1 and t['predictions'] >= 1, (s, t))
    verifier('indicateurs : visites, prédictions, retour J1', s == 200 and r['visites'] >= 3 and r['predictions'] >= 1 and r['retour']['j1'] >= 1 and r['retour']['j1_base'] >= r['retour']['j1'], r)
    verifier('temps avant la 1re prédiction calculé', s == 200 and r['minutes_premiere_prediction'] is not None, r.get('minutes_premiere_prediction') if s == 200 else r)

    # ---------------- Réglages du fil
    s, r = rpc('modifier_reglage_fil', u1, {'p_cle': 'coef_a', 'p_valeur': 5})
    verifier('modifier un réglage du fil : admin seulement', s >= 400 and r.get('hint') == 'reserve_admin', (s, r))
    s, r = rpc('modifier_reglage_fil', adm, {'p_cle': 'coef_g', 'p_valeur': 9})
    verifier('valeur hors limites refusée', s >= 400 and r.get('hint') == 'hors_limites', (s, r))
    s, r = rpc('modifier_reglage_fil', adm, {'p_cle': 'n_existe_pas', 'p_valeur': 1})
    verifier('réglage inconnu refusé', s >= 400, (s, r))
    s, r = rpc('modifier_reglage_fil', adm, {'p_cle': 'coef_g', 'p_valeur': 1.25})
    verifier('admin : coefficient décimal enregistré et journalisé', s in (200, 204) and float(sql("select valeur from public.reglages_fil where cle = 'coef_g'")[0]['valeur']) == 1.25
             and len(sql(f"select 1 from public.journal_admin where auteur_id = '{adm['id']}' and action = 'reglage_fil_modifie'")) == 1, (s, r))
    sql("select public.calculer_scores_fil()")
    sc2 = sql(f"select s.score_tendance, extract(epoch from now() - m.date_publication) / 3600 as heures from public.scores_marches s join public.marches m on m.id = s.marche_id where marche_id = {f1}")[0]
    verifier('nouveau coefficient G utilisé au calcul suivant', abs(float(sc2['score_tendance']) - ((12) / (float(sc2['heures']) + 2) ** 1.25 + 2)) < 0.01, sc2)
    s, r = req('GET', '/rest/v1/reglages_fil?select=cle,valeur', A)
    verifier('réglages du fil lisibles par tous (affichage des sections)', s == 200 and len(r) == len(ORIGINE), (s, len(r) if isinstance(r, list) else r))
    s, r = req('PATCH', '/rest/v1/reglages_fil?cle=eq.coef_a', A, adm['jeton'], {'valeur': 50})
    verifier('aucune écriture directe dans reglages_fil (même admin)', s >= 400 or float(sql("select valeur from public.reglages_fil where cle = 'coef_a'")[0]['valeur']) == float(ORIGINE['coef_a']), (s, r))
    s, r = req('PATCH', '/rest/v1/scores_marches?marche_id=eq.%d' % f1, A, adm['jeton'], {'score_tendance': 1000})
    verifier('aucune écriture directe dans scores_marches', s >= 400 or float(sql(f"select score_tendance from public.scores_marches where marche_id = {f1}")[0]['score_tendance']) < 1000, (s, r))

    # Marché fermé : sort des scores au calcul suivant
    sql(f"update public.marches set date_fin = now() - interval '1 minute' where id = {b1}; select public.calculer_scores_fil();")
    verifier('marché échu : retiré des scores', sql(f"select count(*) as n from public.scores_marches where marche_id = {b1}")[0]['n'] == '0')
finally:
    for k, v in ORIGINE.items():
        sql(f"update public.reglages_fil set valeur = {v}, modifie_par = null where cle = '{k}'")
    sql("delete from public.evenements_fil where visiteur_id::text like 'eeeeeeee-0000-4000-%'")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
