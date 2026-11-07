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


def solde(c):
    return int(sql(f"select solde_pieces from public.utilisateurs where id = '{c['id']}'")[0]['solde_pieces'])


def dans(h=0, j=0, mn=0):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=h, days=j, minutes=mn)).isoformat()


try:
    adm, cur, u1, u2 = creer('Adm'), creer('Cur'), creer('U1'), creer('U2')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")

    # ---------------- Réglages
    s, r = req('GET', '/rest/v1/reglages?select=cle,valeur&cle=eq.limite_mise_quotidienne', A)
    verifier('réglages lisibles par tous', r == [{'cle': 'limite_mise_quotidienne', 'valeur': 2000}], r)
    s, r = rpc('modifier_reglage', u1, {'p_cle': 'bonus_inscription', 'p_valeur': 5000})
    verifier('un utilisateur ne peut pas modifier un réglage', s >= 400, (s, r))
    s, r = rpc('modifier_reglage', adm, {'p_cle': 'bonus_inscription', 'p_valeur': 99999})
    verifier('valeur hors limites refusée', s >= 400 and r.get('hint') == 'hors_limites', (s, r))
    s, r = rpc('modifier_reglage', adm, {'p_cle': 'bonus_inscription', 'p_valeur': 500})
    nouveau = creer('Nouv')
    verifier('bonus d\'inscription modifié (500) appliqué au nouveau compte', solde(nouveau) == 500, solde(nouveau))
    rpc('modifier_reglage', adm, {'p_cle': 'bonus_inscription', 'p_valeur': 1000})
    s, r = rpc('modifier_reglage', adm, {'p_cle': 'whatsapp_equipe', 'p_valeur': None, 'p_texte': 'abc'})
    verifier('numéro WhatsApp invalide refusé', s >= 400, (s, r))

    # ---------------- Création de marchés par l'admin
    s, m_ligne = rpc('creer_marche_admin', adm, {'p_question': 'Test KongoX : marché créé en ligne par l\'admin ?', 'p_categorie': 'football',
                                                 'p_source': 'Test', 'p_date_fin': dans(j=3), 'p_etat': 'en_ligne'})
    verifier('admin : marché créé directement en ligne', s == 200, (s, m_ligne))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_ligne}&select=statut', A)
    verifier('marché en ligne visible du public', r == [{'statut': 'approuve'}], r)
    s, r = rpc('creer_marche_admin', u1, {'p_question': 'Test KongoX : un utilisateur peut-il créer en ligne ?', 'p_categorie': 'football',
                                          'p_source': 'Test', 'p_date_fin': dans(j=3), 'p_etat': 'en_ligne'})
    verifier('un utilisateur ne peut pas créer directement', s >= 400, (s, r))
    s, m_brouillon = rpc('creer_marche_admin', adm, {'p_question': 'Test KongoX : marché brouillon de football ?', 'p_categorie': 'football',
                                                     'p_source': 'Test', 'p_date_fin': dans(j=3), 'p_etat': 'brouillon'})
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_brouillon}&select=id', A)
    verifier('brouillon invisible du public', r == [], r)
    # Curateur football : ne voit pas le brouillon de son thème
    s, cand = rpc('postuler_curateur', cur, {'p_categorie': 'football', 'p_motivation': 'Motivation de test assez longue pour passer.'})
    rpc('traiter_candidature', adm, {'p_candidature': cand, 'p_accepter': True})
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_brouillon}&select=id', A, cur['jeton'])
    verifier('un curateur ne voit pas les brouillons de son thème', r == [], r)
    s, r = rpc('changer_etat_marche', adm, {'p_marche': m_brouillon, 'p_action': 'programmer'})
    verifier('programmer sans date de publication future : refusé', s >= 400 and r.get('hint') == 'date_publication_invalide', (s, r))

    # ---------------- Programmation et publication automatique
    s, m_prog = rpc('creer_marche_admin', adm, {'p_question': 'Test KongoX : marché programmé et Soki ?', 'p_categorie': 'politique',
                                                'p_source': 'Test', 'p_date_fin': dans(j=2), 'p_etat': 'programme',
                                                'p_date_publication': dans(h=1), 'p_soki_programme': True})
    verifier('marché programmé', s == 200 and sql(f"select statut from public.marches where id = {m_prog}")[0]['statut'] == 'programme', (s, m_prog))
    sql(f"update public.marches set date_publication = now() - interval '1 minute' where id = {m_prog}")
    sql("select public.publier_marches_programmes()")
    r = sql(f"select statut, soki_du_jour from public.marches where id = {m_prog}")[0]
    verifier('publication automatique à l\'heure + devient Soki du jour', r == {'statut': 'approuve', 'soki_du_jour': True}, r)
    r = sql("select count(*) as n from public.marches where soki_du_jour")[0]
    verifier('un seul Soki du jour', r['n'] == '1', r)

    # ---------------- Modifier : libre avant mise, verrouillé après
    s, r = rpc('modifier_marche_admin', adm, {'p_marche': m_ligne, 'p_question': 'Test KongoX : texte corrigé avant toute mise ?', 'p_categorie': 'football',
                                              'p_source': 'Test', 'p_date_fin': dans(j=4), 'p_date_publication': None, 'p_mis_en_avant': True, 'p_soki_programme': False})
    verifier('modification libre tant qu\'il n\'y a aucune mise', s in (200, 204), (s, r))
    o = sql(f"select id from public.options_marche where marche_id = {m_ligne} order by ordre")
    rpc('placer_prediction', u1, {'p_marche': m_ligne, 'p_option': int(o[0]['id']), 'p_montant': 300})
    rpc('placer_prediction', u2, {'p_marche': m_ligne, 'p_option': int(o[1]['id']), 'p_montant': 200})
    s, r = rpc('modifier_marche_admin', adm, {'p_marche': m_ligne, 'p_question': 'Test KongoX : texte changé après des mises ?', 'p_categorie': 'football',
                                              'p_source': 'Test', 'p_date_fin': dans(j=4), 'p_date_publication': None, 'p_mis_en_avant': True, 'p_soki_programme': False})
    verifier('après une mise : changer la question est refusé', s >= 400 and r.get('hint') == 'verrouille_mises', (s, r))
    s, r = rpc('modifier_marche_admin', adm, {'p_marche': m_ligne, 'p_question': 'Test KongoX : texte corrigé avant toute mise ?', 'p_categorie': 'football',
                                              'p_source': 'Test', 'p_date_fin': dans(j=6), 'p_date_publication': None, 'p_mis_en_avant': False, 'p_soki_programme': False})
    verifier('après une mise : la date de fin et la mise en avant peuvent changer', s in (200, 204), (s, r))
    j = sql(f"select action, avant, apres from public.journal_admin where cible_marche = {m_ligne} and action = 'marche_modifie_admin' order by id")
    verifier('journal : avant / après de la modification', len(j) >= 1 and 'question' in (j[0]['avant'] or {}), j)

    # ---------------- Mise minimum réglable
    rpc('modifier_reglage', adm, {'p_cle': 'mise_minimum', 'p_valeur': 20})
    s, r = rpc('placer_prediction', u1, {'p_marche': m_ligne, 'p_option': int(o[0]['id']), 'p_montant': 15})
    verifier('mise minimum réglable (20) : 15 refusé', s >= 400 and r.get('hint') == 'montant_invalide' and r.get('details') == '20', (s, r))
    rpc('modifier_reglage', adm, {'p_cle': 'mise_minimum', 'p_valeur': 10})

    # ---------------- Supprimer avec remboursement
    s1, s2 = solde(u1), solde(u2)
    s, r = rpc('mises_en_cours', adm, {'p_marche': m_ligne})
    verifier('confirmation : 2 mises, 500 pièces', r == {'mises': 2, 'pieces': 500}, r)
    s, r = rpc('supprimer_marche', adm, {'p_marche': m_ligne, 'p_motif': ''})
    verifier('suppression sans motif refusée', s >= 400 and r.get('hint') == 'motif_obligatoire', (s, r))
    s, r = rpc('supprimer_marche', adm, {'p_marche': m_ligne, 'p_motif': 'Test de suppression'})
    verifier('suppression : 2 mises remboursées', s == 200 and r == 2 and solde(u1) == s1 + 300 and solde(u2) == s2 + 200, (s, r, solde(u1), solde(u2)))
    s, r = req('GET', f'/rest/v1/marches?id=eq.{m_ligne}&select=id', A)
    verifier('marché supprimé invisible du public', r == [], r)
    s, r = rpc('supprimer_marche', adm, {'p_marche': m_ligne, 'p_motif': 'Encore'})
    verifier('supprimer deux fois : refusé', s >= 400, (s, r))

    # ---------------- Dupliquer, publier, fermer
    s, copie = rpc('dupliquer_marche', adm, {'p_marche': m_prog})
    r = sql(f"select statut, question from public.marches where id = {copie}")[0]
    verifier('dupliquer : copie en brouillon', r['statut'] == 'brouillon' and r['question'].startswith('Test KongoX : marché programmé'), r)
    s, r = rpc('changer_etat_marche', adm, {'p_marche': copie, 'p_action': 'publier'})
    verifier('publier un brouillon tout de suite', s in (200, 204) and sql(f"select statut from public.marches where id = {copie}")[0]['statut'] == 'approuve', (s, r))
    s, r = rpc('changer_etat_marche', adm, {'p_marche': copie, 'p_action': 'fermer'})
    verifier('fermer un marché en ligne', s in (200, 204) and sql(f"select statut from public.marches where id = {copie}")[0]['statut'] == 'ferme', (s, r))

    # ---------------- Marchés récurrents
    heure = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1, minutes=30)).strftime('%H:%M')  # UTC
    heure_kin = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2, minutes=30)).strftime('%H:%M')  # Kinshasa = UTC+1
    s, mod = rpc('creer_modele_recurrent', adm, {'p_question': 'Test KongoX : y aura-t-il une coupure le {date} ?', 'p_categorie': 'vie_quotidienne',
                                                 'p_source': 'Test', 'p_frequence': 'quotidienne', 'p_jour_semaine': None, 'p_heure': heure_kin,
                                                 'p_duree_heures': 12, 'p_soki': False})
    verifier('modèle récurrent créé', s == 200, (s, mod))
    n1 = sql("select public.generer_recurrences() as n")[0]['n']
    n2 = sql("select public.generer_recurrences() as n")[0]['n']
    r = sql(f"select statut, question, date_publication from public.marches where modele_id = {mod}")
    verifier('récurrence : 1 marché programmé dans les 24 h, avec la date dans la question', len(r) == 1 and r[0]['statut'] == 'programme' and '{date}' not in r[0]['question'] and '/' in r[0]['question'], r)
    verifier('pas de doublon au deuxième passage', n2 == 0, (n1, n2))
    s, r = rpc('creer_modele_recurrent', adm, {'p_question': 'Test KongoX : modèle hebdomadaire sans jour ?', 'p_categorie': 'politique',
                                               'p_source': 'Test', 'p_frequence': 'hebdomadaire', 'p_jour_semaine': None, 'p_heure': '08:00',
                                               'p_duree_heures': 24, 'p_soki': True})
    verifier('modèle hebdomadaire sans jour refusé', s >= 400 and r.get('hint') == 'frequence_invalide', (s, r))
    s, r = rpc('activer_modele', adm, {'p_modele': mod, 'p_actif': False})
    verifier('désactiver un modèle', s in (200, 204) and sql(f"select actif from public.modeles_recurrents where id = {mod}")[0]['actif'] is False, (s, r))

    # ---------------- Ajustements de pièces
    s1 = solde(u1)
    s, r = rpc('ajuster_pieces', adm, {'p_utilisateur': u1['id'], 'p_montant': 500, 'p_raison': 'Compensation panne'})
    verifier('ajouter 500 pièces', s == 200 and solde(u1) == s1 + 500, (s, r))
    s, r = rpc('ajuster_pieces', adm, {'p_utilisateur': u1['id'], 'p_montant': -(s1 + 501), 'p_raison': 'Trop'})
    verifier('retrait qui rendrait le solde négatif : refusé', s >= 400 and r.get('hint') == 'solde_negatif', (s, r))
    s, r = rpc('ajuster_pieces', adm, {'p_utilisateur': u1['id'], 'p_montant': -200, 'p_raison': 'Correction'})
    verifier('retirer 200 pièces', s == 200 and solde(u1) == s1 + 300, (s, r))
    s, r = rpc('ajuster_pieces', adm, {'p_utilisateur': adm['id'], 'p_montant': 100, 'p_raison': 'Pour moi'})
    verifier('ajustement sur soi-même : refusé', s >= 400 and r.get('hint') == 'soi_meme', (s, r))
    s, r = rpc('ajuster_pieces', adm, {'p_utilisateur': u1['id'], 'p_montant': 100, 'p_raison': ''})
    verifier('raison obligatoire', s >= 400 and r.get('hint') == 'raison_obligatoire', (s, r))
    s, r = rpc('ajuster_pieces', u2, {'p_utilisateur': u2['id'], 'p_montant': 100, 'p_raison': 'Je triche'})
    verifier('un utilisateur ne peut pas s\'ajouter des pièces', s >= 400, (s, r))
    r = sql(f"select montant, solde_avant, solde_apres, raison from public.ajustements_pieces where utilisateur_id = '{u1['id']}' order by id")
    verifier('historique des ajustements (avant / après)', len(r) == 2 and r[0]['montant'] == '500' and int(r[0]['solde_apres']) - int(r[0]['solde_avant']) == 500, r)

    # ---------------- Bonus en masse
    s1, s2, sa = solde(u1), solde(u2), solde(adm)
    s, r = rpc('bonus_en_masse', adm, {'p_cible': 'liste', 'p_noms': [u1['nom'].upper(), u2['nom'], adm['nom'], 'Inconnu_xyz'], 'p_montant': 50, 'p_raison': 'Merci'})
    verifier('bonus en masse (liste) : 2 comptes, jamais soi-même', s == 200 and r['comptes'] == 2 and solde(u1) == s1 + 50 and solde(u2) == s2 + 50 and solde(adm) == sa, (s, r))
    rpc('reclamer_bonus_quotidien', nouveau, {})
    s, r = rpc('bonus_en_masse', adm, {'p_cible': 'actifs_7j', 'p_noms': None, 'p_montant': 10, 'p_raison': 'Actifs'})
    verifier('bonus en masse aux actifs (7 j)', s == 200 and r['comptes'] >= 3, (s, r))
    s, r = rpc('bonus_en_masse', adm, {'p_cible': 'liste', 'p_noms': ['Inconnu_xyz'], 'p_montant': 50, 'p_raison': 'Rien'})
    verifier('aucun compte trouvé : refusé', s >= 400 and r.get('hint') == 'aucun_compte', (s, r))

    # ---------------- Tableau de bord
    s, r = rpc('tableau_de_bord', adm, {})
    verifier('tableau de bord du jour', s == 200 and r['inscrits'] >= 5 and r['predictions'] >= 2 and 'actifs' in r, (s, r))
    s, r = rpc('series_tableau_de_bord', adm, {'p_jours': 7})
    verifier('séries sur 7 jours (7 points)', s == 200 and len(r) == 7, (s, r if s != 200 else len(r)))
    s, r = rpc('series_tableau_de_bord', adm, {'p_jours': None})
    verifier('séries « tout »', s == 200 and len(r) >= 1, (s, r))
    s, r = rpc('tableau_de_bord', u1, {})
    verifier('tableau de bord refusé à un utilisateur', s >= 400, (s, r))

    # ---------------- Journal et sécurité
    r = sql(f"select action, avant, apres from public.journal_admin where cible_utilisateur = '{cur['id']}' and action = 'candidature_acceptee'")
    verifier('journal : rôle avant / après pour la candidature acceptée', len(r) == 1 and r[0]['avant']['role'] == 'utilisateur' and r[0]['apres']['role'] == 'curateur', r)
    s, r = req('GET', '/rest/v1/ajustements_pieces?select=id', A, u1['jeton'])
    verifier('historique des ajustements invisible pour un utilisateur', r == [], r)
    s, r = req('GET', '/rest/v1/modeles_recurrents?select=id', A, u1['jeton'])
    verifier('modèles invisibles pour un utilisateur', r == [], r)

    # ---------------- Conservation des pièces
    ids = ','.join("'%s'" % x['id'] for x in comptes.values())
    r = sql(f"select (select sum(solde_pieces) from public.utilisateurs where id in ({ids})) as soldes, (select sum(montant) from public.transactions_pieces where utilisateur_id in ({ids})) as journal")[0]
    verifier('soldes = somme du journal des pièces', r['soldes'] == r['journal'], r)
finally:
    sql("""update public.reglages set valeur = case cle when 'bonus_inscription' then 1000 when 'mise_minimum' then 10 else valeur end
           where cle in ('bonus_inscription', 'mise_minimum');""")
    sql(open(os.path.join(PG, 'nettoyage.sql'), encoding='utf-8').read())
    sql("delete from public.modeles_recurrents where question_modele like 'Test KongoX%'")
    print('nettoyage fait :', sql("select (select count(*) from public.marches) as marches, (select count(*) from public.modeles_recurrents) as modeles, (select count(*) from public.marches where soki_du_jour) as soki, (select string_agg(cle || '=' || coalesce(valeur::text, texte), ', ') from public.reglages where cle in ('bonus_inscription','mise_minimum')) as reglages"))
print('\nRESULTAT :', 'tout est bon' if ok else 'il y a des echecs')
