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


import time


def envoyer(c, texte, marche=None, communaute=None):
    return rpc('envoyer_message', c, {'p_marche': marche, 'p_communaute': communaute, 'p_texte': texte})


def hint(r):
    return r.get('hint') if isinstance(r, dict) else None


ORIG = {r['cle']: r['valeur'] for r in sql("select cle, valeur from public.reglages where cle like 'chat_%'")}
com = None
try:
    adm, u1, u2, u3, u4 = creer('Adm'), creer('U1'), creer('U2'), creer('U3'), creer('U4')
    sql(f"update public.utilisateurs set role = 'admin' where id = '{adm['id']}'")
    sql("update public.reglages set valeur = 0 where cle = 'chat_intervalle_secondes'")
    m = marche('le chat marche-t-il bien ?', 'musique', 2)
    attente = int(sql("""insert into public.marches (question, categorie, date_fin, source, statut) values
                         ('Test KongoX fil : marché en attente de chat ?', 'musique', now() + interval '3 days', 'Source', 'en_attente') returning id""")[0]['id'])
    com = int(sql("insert into public.communautes (nom, type, active) values ('Test KongoX Communauté', 'ville', true) returning id")[0]['id'])
    miser(u1, m, True, 100); miser(u1, m, False, 30); miser(u2, m, False, 50)

    # ---------------- Envoi
    s, r = req('POST', '/rest/v1/rpc/envoyer_message', A, None, {'p_marche': m, 'p_communaute': None, 'p_texte': 'Bonjour'})
    verifier('visiteur : écriture refusée', s >= 400, (s, r))
    s, r = envoyer(u1, '  Tokolonga !  ', marche=m)
    verifier('message envoyé (texte nettoyé, nom de l\'auteur copié)', s == 200 and r['texte'] == 'Tokolonga !' and r['auteur_nom'] == u1['nom'], (s, r))
    verifier('badge : option la plus misée par l\'auteur (OUI)', r.get('choix') == 'OUI', r)
    s, r2 = envoyer(u2, 'Je pense que non.', marche=m)
    verifier('badge NON pour u2', s == 200 and r2['choix'] == 'NON', r2)
    s, r3 = envoyer(u3, 'Pas encore misé.', marche=m)
    verifier('pas de badge sans mise', s == 200 and r3['choix'] is None, r3)
    s, r = envoyer(u1, 'Espèce de CONNARD, va sur www.arnaque.com — nique ta mère ! connardise ok', marche=m)
    verifier('filtre : mots interdits en étoiles (accents, majuscules, expression), liens retirés, mot entier', s == 200 and r['texte'] == 'Espèce de *******, va sur [lien retiré] — ************* ! connardise ok', r)
    s, r = envoyer(u1, 'x' * 501, marche=m)
    verifier('message trop long refusé', hint(r) == 'chat_longueur', (s, r))
    s, r = envoyer(u1, '   ', marche=m)
    verifier('message vide refusé', hint(r) == 'chat_longueur', (s, r))
    s, r = envoyer(u1, 'Les deux à la fois', marche=m, communaute=com)
    verifier('un seul salon à la fois', hint(r) == 'salon_invalide', (s, r))
    s, r = envoyer(u1, 'Marché pas en ligne', marche=attente)
    verifier('marché en attente : pas de salon', hint(r) == 'salon_invalide', (s, r))
    s, r = envoyer(u1, 'Je ne suis pas membre', communaute=com)
    verifier('communauté : réservé aux membres', hint(r) == 'reserve_membres', (s, r))
    sql(f"insert into public.membres_communaute (communaute_id, utilisateur_id) values ({com}, '{u1['id']}')")
    s, r = envoyer(u1, 'Mbote na bino !', communaute=com)
    verifier('communauté : un membre écrit', s == 200 and int(r['communaute_id']) == com and r['marche_id'] is None, r)

    # Vitesse
    sql("update public.reglages set valeur = 30 where cle = 'chat_intervalle_secondes'")
    s, r = envoyer(u1, 'Encore un', marche=m)
    verifier('limite : un message toutes les N secondes', hint(r) == 'chat_trop_vite', (s, r))
    sql("update public.reglages set valeur = 0 where cle = 'chat_intervalle_secondes'")
    sql("update public.reglages set valeur = 3 where cle = 'chat_messages_10min'")
    s, r = envoyer(u1, 'Encore un', marche=m)
    verifier('limite : N messages en 10 minutes', hint(r) == 'chat_limite', (s, r))
    sql(f"update public.reglages set valeur = {ORIG['chat_messages_10min']} where cle = 'chat_messages_10min'")

    # Écriture directe interdite
    s, r = req('POST', '/rest/v1/messages_chat', A, u1['jeton'], {'marche_id': m, 'auteur_id': u1['id'], 'auteur_nom': 'Faux', 'texte': 'direct'})
    verifier('aucune écriture directe dans messages_chat', s >= 400, (s, r))
    s, r = req('PATCH', f"/rest/v1/messages_chat?id=eq.{r2['id']}", A, u2['jeton'], {'texte': 'modifié'})
    verifier('aucune modification directe d\'un message', s >= 400 or sql(f"select texte from public.messages_chat where id = {r2['id']}")[0]['texte'] == 'Je pense que non.', (s, r))
    s, r = req('GET', f'/rest/v1/messages_chat?select=id,texte&marche_id=eq.{m}', A)
    verifier('salon lisible par un visiteur', s == 200 and len(r) == 4, (s, r))

    # Commentaires comptés dans le fil
    sql("select public.calculer_scores_fil()")
    sc = sql(f"select commentaires_24h, commentaires_total from public.scores_marches where marche_id = {m}")[0]
    verifier('fil : commentaires comptés dans le score (B)', sc == {'commentaires_24h': 4, 'commentaires_total': 4}, sc)

    # Suspension et blocage
    sql(f"update auth.users set banned_until = now() + interval '1 day' where id = '{u3['id']}'")
    s, r = envoyer(u3, 'Je suis suspendu', marche=m)
    verifier('compte suspendu : écriture refusée (même avec un jeton encore valide)', hint(r) == 'compte_suspendu', (s, r))
    sql(f"update auth.users set banned_until = null where id = '{u3['id']}'")
    s, r = rpc('bloquer_chat', u1, {'p_utilisateur': u3['id'], 'p_heures': 24})
    verifier('bloquer du chat : admin seulement', s >= 400 and hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('bloquer_chat', adm, {'p_utilisateur': u3['id'], 'p_heures': 24})
    verifier('admin : bloque u3 24 h', s in (200, 204), (s, r))
    s, r = envoyer(u3, 'Je suis bloqué', marche=m)
    verifier('bloqué du chat : écriture refusée', hint(r) == 'chat_bloque', (s, r))
    s, r = req('GET', '/rest/v1/blocages_chat?select=utilisateur_id', A, u1['jeton'])
    verifier('blocages invisibles pour les autres', s == 200 and r == [], (s, r))
    s, r = req('GET', '/rest/v1/blocages_chat?select=utilisateur_id', A, u3['jeton'])
    verifier('la personne bloquée voit son blocage', s == 200 and len(r) == 1, (s, r))
    rpc('bloquer_chat', adm, {'p_utilisateur': u3['id'], 'p_heures': 0})
    s, r = envoyer(u3, 'Débloqué !', marche=m)
    verifier('débloqué : écriture de nouveau possible', s == 200, (s, r))
    verifier('journal : blocage et déblocage', len(sql(f"select 1 from public.journal_admin where cible_utilisateur = '{u3['id']}' and action in ('chat_bloque', 'chat_debloque')")) == 2)

    # ---------------- Signalements
    cible = int(r2['id'])  # message de u2
    s, r = req('POST', '/rest/v1/rpc/signaler', A, None, {'p_message': cible, 'p_marche': None, 'p_motif': 'insulte'})
    verifier('visiteur : signalement refusé', s >= 400, s)
    s, r = rpc('signaler', u2, {'p_message': cible, 'p_marche': None, 'p_motif': 'insulte'})
    verifier('impossible de signaler son propre message', hint(r) == 'soi_meme', (s, r))
    s, r = rpc('signaler', u1, {'p_message': cible, 'p_marche': None, 'p_motif': 'pas_un_motif'})
    verifier('motif invalide refusé', hint(r) == 'signalement_invalide', (s, r))
    s, r = rpc('signaler', u1, {'p_message': cible, 'p_marche': None, 'p_motif': 'insulte', 'p_detail': 'Il insulte'})
    verifier('signalement enregistré', s == 200 and r == 'enregistre', (s, r))
    s, r = rpc('signaler', u1, {'p_message': cible, 'p_marche': None, 'p_motif': 'spam'})
    verifier('un seul signalement par personne et par message', s == 200 and r == 'deja', (s, r))
    s, r = rpc('signaler', u3, {'p_message': cible, 'p_marche': None, 'p_motif': 'insulte'})
    verifier('2e signalement : pas encore masqué', r == 'enregistre' and not sql(f"select masque from public.messages_chat where id = {cible}")[0]['masque'])
    s, r = rpc('signaler', u4, {'p_message': cible, 'p_marche': None, 'p_motif': 'arnaque'})
    x = sql(f"select masque, texte from public.messages_chat where id = {cible}")[0]
    verifier('3e signalement : message masqué automatiquement, texte retiré du salon', r == 'masque' and x == {'masque': True, 'texte': None}, (r, x))
    s, r = req('GET', f'/rest/v1/messages_masques?select=texte&message_id=eq.{cible}', A, u1['jeton'])
    verifier('texte d\'origine invisible pour un utilisateur', s == 200 and r == [], (s, r))
    s, r = req('GET', f'/rest/v1/messages_masques?select=texte,motif&message_id=eq.{cible}', A, adm['jeton'])
    verifier('texte d\'origine lisible par un admin', s == 200 and r == [{'texte': 'Je pense que non.', 'motif': 'signalements'}], (s, r))
    s, r = req('GET', '/rest/v1/signalements?select=id', A, u3['jeton'])
    verifier('chacun ne voit que ses signalements', s == 200 and len(r) == 1, (s, r))
    s, r = req('GET', '/rest/v1/mots_interdits?select=mot', A, u1['jeton'])
    verifier('liste des mots interdits invisible pour un utilisateur', s == 200 and r == [], (s, r))

    s, r = rpc('retablir_message', u1, {'p_message': cible})
    verifier('rétablir : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('retablir_message', adm, {'p_message': cible})
    x = sql(f"select masque, texte from public.messages_chat where id = {cible}")[0]
    verifier('admin : message rétabli, signalements rejetés', x == {'masque': False, 'texte': 'Je pense que non.'}
             and sql(f"select distinct statut from public.signalements where message_id = {cible}") == [{'statut': 'rejete'}], x)

    s, r = rpc('masquer_message', adm, {'p_message': int(r3['id']), 'p_motif': 'Hors sujet'})
    x = sql(f"select masque from public.messages_chat where id = {r3['id']}")[0]
    verifier('admin : masquer un message à la main (journalisé)', s in (200, 204) and x['masque'] and len(sql(f"select 1 from public.journal_admin where action = 'message_masque' and auteur_id = '{adm['id']}'")) == 1, (s, r))
    s, r = rpc('signaler', u1, {'p_message': None, 'p_marche': m, 'p_motif': 'ligne_rouge'})
    verifier('signaler un marché', r == 'enregistre', (s, r))
    sid = int(sql(f"select id from public.signalements where marche_id = {m}")[0]['id'])
    s, r = rpc('traiter_signalement', u1, {'p_signalement': sid, 'p_statut': 'traite'})
    verifier('traiter un signalement : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('traiter_signalement', adm, {'p_signalement': sid, 'p_statut': 'traite'})
    verifier('admin : signalement de marché traité', sql(f"select statut from public.signalements where id = {sid}")[0]['statut'] == 'traite', (s, r))
    s, r = rpc('signaler', u1, {'p_message': None, 'p_marche': attente, 'p_motif': 'spam'})
    verifier('marché pas en ligne : signalement refusé', hint(r) == 'signalement_invalide', (s, r))

    # Mots interdits
    s, r = rpc('ajouter_mot_interdit', u1, {'p_mot': 'zut'})
    verifier('ajouter un mot : admin seulement', hint(r) == 'reserve_admin', (s, r))
    s, r = rpc('ajouter_mot_interdit', adm, {'p_mot': '  Zùt   Alors '})
    verifier('admin : mot ajouté (simplifié : « zut alors »)', len(sql("select 1 from public.mots_interdits where mot = 'zut alors'")) == 1, (s, r))
    s, r = rpc('ajouter_mot_interdit', adm, {'p_mot': '<script>'})
    verifier('mot invalide refusé', hint(r) == 'hors_limites', (s, r))
    s, r = envoyer(u4, 'Oh ZUT alors, raté.', marche=m)
    verifier('nouveau mot filtré tout de suite', s == 200 and r['texte'] == 'Oh *********, raté.', r)
    mid = int(sql("select id from public.mots_interdits where mot = 'zut alors'")[0]['id'])
    rpc('retirer_mot_interdit', adm, {'p_id': mid})
    verifier('admin : mot retiré', len(sql("select 1 from public.mots_interdits where mot = 'zut alors'")) == 0)

    # Realtime : la table est publiée
    verifier('Realtime : messages_chat dans la publication supabase_realtime',
             len(sql("select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages_chat'")) == 1)
    verifier('RLS activée sur les 5 tables du chat', sql("select bool_and(relrowsecurity) as ok from pg_class where relname in ('messages_chat','messages_masques','mots_interdits','signalements','blocages_chat') and relnamespace = 'public'::regnamespace")[0]['ok'])
    s, r = rpc('filtrer_texte', u1, {'p_texte': 'x'})
    verifier('filtrer_texte interne (pas appelable)', s >= 400, s)
finally:
    for k, v in ORIG.items():
        sql(f"update public.reglages set valeur = {v} where cle = '{k}'")
    if com:
        sql(f"delete from public.communautes where id = {com}")
    print('Comptes de test :', ', '.join(c['nom'] for c in comptes.values()))

print('\nRÉSULTAT :', 'TOUT EST BON' if ok else 'DES TESTS ÉCHOUENT')
