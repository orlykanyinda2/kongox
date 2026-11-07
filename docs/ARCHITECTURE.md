# Architecture de KongoX

Ce document décrit la base de données, les rôles et le parcours des pièces. Il évolue avec le projet : Claude Code doit le mettre à jour quand il ajoute une table ou change une règle.

## Vue d'ensemble

```
Navigateur (PWA Next.js)
   │  pages, composants, next-intl (français)
   ▼
Next.js (serveur, routes API, Server Actions)
   │  clé secrète Supabase côté serveur uniquement
   ▼
Supabase
   ├── Auth       (nom d'utilisateur + mot de passe)
   ├── PostgreSQL (tables + fonctions SQL des pièces + RLS)
   ├── Realtime   (chat, pourcentages en direct)
   └── Storage    (avatars, cartes de partage)

Services externes : API-Football (matchs) · API IA (assistant)
```

## Tables créées (étape 1)

Migration : `supabase/migrations/20261106120000_connexion_et_pieces.sql`.

| Table | Colonnes principales | Qui peut lire | Qui peut écrire |
| --- | --- | --- | --- |
| `utilisateurs` | `id` (= compte Auth), `nom_utilisateur` (unique sans tenir compte des majuscules, 3 à 24 caractères `A-Z a-z 0-9 _`), `role`, `solde_pieces` (jamais négatif), `serie_jours`, `dernier_bonus_le`, `badges`, `cree_le` | Tout le monde (profil public) | Personne depuis le navigateur : seulement les fonctions SQL |
| `coordonnees_utilisateurs` | `utilisateur_id`, `email_contact`, `telephone` (format `+243…`, unique : un cadeau par numéro), `modifie_le` | Le propriétaire (et les admins par la clé service role) | Le propriétaire, seulement `email_contact` et `telephone` |
| `transactions_pieces` | `utilisateur_id`, `montant` (+ gain, − dépense), `type`, `solde_apres`, `description`, `cree_le` | Le propriétaire | Personne : seulement `mouvement_pieces()`. Une ligne ne peut jamais être modifiée (déclencheur) |

Types de transaction : `inscription`, `bonus_quotidien`, `bonus_serie`, `mise`, `gain`, `remboursement`, `question_approuvee`. Pour en ajouter, modifier la contrainte `transactions_type_valide`. Depuis l'étape 2, chaque transaction peut pointer vers son marché (`marche_id`).

## Tables créées (étape 2)

Migrations : `supabase/migrations/20261107090000_marches_et_predictions.sql` et `20261107090100_fermeture_automatique.sql`. Données d'exemple : `supabase/seed.sql`.

| Table | Colonnes principales | Qui peut lire | Qui peut écrire |
| --- | --- | --- | --- |
| `marches` | `question` (15 à 200 caractères), `categorie` (`football`, `musique`, `politique`, `vie_quotidienne`), `type_reponse` (`oui_non` ; `choix_multiples` plus tard), `date_fin`, `source`, `statut`, `auteur_id`, `soki_du_jour`, `motif`, `option_gagnante_id`, `lien_resultat`, `examine_par`, `examine_le`, `regle_le` | Tout le monde pour les marchés publiés (`approuve`, `ferme`, `regle`) ; l'auteur voit ses questions en attente ou refusées ; les admins voient tout | Personne depuis le navigateur : seulement les fonctions SQL |
| `options_marche` | `marche_id`, `libelle` (`OUI` / `NON`), `ordre` (0 = OUI), `total_mise` (la cagnotte de ce côté) | Comme le marché | Seulement `placer_prediction()` |
| `predictions` | `utilisateur_id`, `marche_id`, `option_id`, `montant`, `statut` (`en_cours`, `gagnee`, `perdue`, `remboursee`), `gain` | Le propriétaire | Seulement `placer_prediction()` et le règlement |

**Un marché ne se supprime jamais** : ses transactions pointent vers lui et le journal des pièces est immuable (le déclencheur bloque la suppression). On le refuse ou on l'annule.

## Fonctions SQL (étape 2)

| Fonction | Rôle | Appelable par |
| --- | --- | --- |
| `proposer_marche(question, categorie, date_fin, source)` | Crée la question en `en_attente` avec les options OUI et NON. Question finie par « ? », date de fin entre 24 h et 2 ans, 5 questions en attente maximum par personne | Utilisateur connecté |
| `placer_prediction(marche, option, montant)` | Mise : vérifie marché ouvert, mise ≥ 10, solde, limite de 2 000 pièces par jour (jour de Kinshasa), puis retire les pièces, remplit la cagnotte et crée la prédiction | Utilisateur connecté |
| `mise_restante_aujourdhui()` | Ce qu'il reste à miser aujourd'hui | Utilisateur connecté |
| `approuver_marche(marche)` | `en_attente` → `approuve` ; +50 pièces et badge « Créateur de marché » à l'auteur (une seule fois) | Admin (curateurs à l'étape 3) |
| `refuser_marche(marche, motif)` | `en_attente` → `refuse` | Admin |
| `regler_marche(marche, option_gagnante, lien_resultat)` | Verse la cagnotte aux gagnants (voir ci-dessous) ; lien de la source obligatoire | Admin |
| `annuler_marche(marche, motif)` | Rembourse toutes les mises, statut `regle` sans option gagnante | Admin |
| `fermer_marches_echus()` | `approuve` → `ferme` quand la date de fin est passée. Lancée toutes les 5 minutes par pg_cron | Tout le monde (sans danger) |
| `historique_marche(marche, depuis)` | Évolution du pourcentage OUI après chaque mise (pour le graphique), sans dire qui a misé | Tout le monde |
| `est_admin()` | L'utilisateur connecté est-il admin ? (utilisée par la RLS) | Tout le monde |
| `mouvement_pieces(…, marche)`, `rembourser_marche()`, `mises_du_jour()`, `limite_mise_quotidienne()` | Fonctions internes | Personne depuis l'API |

Les erreurs des fonctions portent un code dans `hint` (`limite_quotidienne`, `solde_insuffisant`, `marche_ferme`…) que l'application traduit en français.

### Calcul des gains (cagnotte)

1. Cagnotte = somme de `total_mise` de toutes les options du marché.
2. Gain d'un gagnant = sa mise × cagnotte ÷ total misé sur la bonne réponse, arrondi vers le bas.
3. Les pièces restantes (restes de la division) sont données une par une aux gagnants qui ont les plus grands restes : **la somme des gains est toujours exactement la cagnotte**.
4. Si personne n'a misé sur la bonne réponse, tout le monde est remboursé.

Exemple testé : OUI 100 + 200, NON 101 → cagnotte 401 ; gains 134 et 267.

### Verrous

`placer_prediction` verrouille le marché (partagé) puis l'utilisateur ; le règlement verrouille le marché (exclusif) puis les utilisateurs. Même ordre partout : pas de blocage mutuel, et aucune mise ne passe pendant un règlement.

## Fonctions SQL (étape 1)

| Fonction | Rôle | Appelable par |
| --- | --- | --- |
| `mouvement_pieces(utilisateur, montant, type, description)` | **Seul chemin pour faire bouger des pièces** : met à jour le solde et écrit la ligne du journal dans la même transaction | Personne depuis l'API (fonctions SQL internes seulement) |
| `creer_profil_utilisateur()` | Déclencheur sur `auth.users` : crée le profil, les coordonnées vides et verse 1 000 pièces, dans la même transaction que le compte. Refuse tout compte dont l'adresse n'est pas `nom@kongox.local` | Déclencheur uniquement |
| `reclamer_bonus_quotidien()` | Bonus du jour et série (voir « Parcours des pièces ») ; verrouille la ligne pour éviter un double bonus | Utilisateur connecté |
| `nom_utilisateur_disponible(nom)` | Le nom est-il libre ? | Tout le monde |

## Tables créées (étape 3)

Migration : `supabase/migrations/20261107100000_admin_et_curateurs.sql`.

| Table | Rôle | Qui peut lire | Qui peut écrire |
| --- | --- | --- | --- |
| `curateurs` | Un curateur par thème : `utilisateur_id`, `categorie`, `statut` (`essai` / `autonome`), `decisions_validees` | Tout le monde | Fonctions SQL (admin) |
| `candidatures_curateur` | Candidatures : thème, motivation (20 à 1 000 caractères), statut (`en_attente`, `acceptee`, `refusee`) | Le candidat et les admins | `postuler_curateur()`, `traiter_candidature()` |
| `decisions_curateur` | Décisions d'un curateur en essai (`approuve` / `refuse`), à valider par un admin (`a_valider`, `validee`, `annulee`) | Le curateur concerné et les admins | Fonctions SQL |
| `cadeaux` | Gagnants marqués par un admin : type (`credit`, `forfait_internet`, `produit`), statut (`a_envoyer`, `envoye`, `annule`), numéro gardé au moment de l'envoi | Le gagnant et les admins | Fonctions SQL (admin) |
| `journal_admin` | Qui a fait quoi : approbations, refus, règlements, annulations, cadeaux, rôles, mots de passe, suspensions | Admins | Fonctions SQL (et un déclencheur sur le règlement) |

Les admins peuvent aussi lire (RLS) les coordonnées, les transactions et les prédictions de tout le monde. Les curateurs voient les questions en attente de leurs thèmes.

## Fonctions SQL (étape 3)

| Fonction | Rôle | Appelable par |
| --- | --- | --- |
| `approuver_marche(marche)` / `refuser_marche(marche, motif)` | **Remplacent celles de l'étape 2.** Admin ou curateur autonome du thème → appliqué tout de suite (renvoie `approuve` / `refuse`). Curateur en essai → décision enregistrée pour un admin (renvoie `en_validation`) | Admin, curateur du thème |
| `valider_decision_curateur(decision, accepter)` | L'admin valide (la décision s'applique et compte pour l'essai) ou rejette | Admin |
| `modifier_marche(marche, question, categorie, date_fin, source)` | Corriger une question en attente | Admin, curateur du thème |
| `definir_soki_du_jour(marche)` | Une seule question « Soki du jour » à la fois | Admin |
| `postuler_curateur(categorie, motivation)` | Candidature (une seule en attente par thème) | Utilisateur connecté |
| `traiter_candidature(candidature, accepter, motif)` | Accepter → curateur en essai, rôle `curateur`, badge « Curateur Football »… | Admin |
| `changer_statut_curateur(utilisateur, categorie, statut)` | `essai`, `autonome` ou `retirer` (badge et rôle retirés) | Admin |
| `changer_role(utilisateur, role)` | `utilisateur`, `curateur`, `admin` (un admin ne peut pas se retirer son propre rôle) | Admin |
| `creer_cadeau(nom, type, description)`, `marquer_cadeau_envoye(cadeau)`, `annuler_cadeau(cadeau)` | Cadeaux manuels. « Envoyé » exige un numéro dans le profil du gagnant | Admin |
| `statistiques_admin()` | Chiffres du tableau de bord | Admin |
| `journaliser_action_admin(action, utilisateur, details)` | Journal des actions faites avec la clé service role (mot de passe, suspension) | Admin |
| `appliquer_approbation()`, `appliquer_refus()`, `clore_decision_curateur()`, `droit_decision()`, `journaliser()` | Fonctions internes | Personne depuis l'API |

### Curateurs : période d'essai

1. L'utilisateur postule sur `/curateur` pour un thème.
2. Un admin accepte : le curateur est **en essai**. Ses approbations et refus deviennent des décisions « à valider ».
3. Quand un admin valide une décision (ou prend la même décision lui-même), elle compte. Une décision contraire de l'admin est annulée et ne compte pas.
4. Après **10 décisions validées** (`seuil_essai_curateur()`), le curateur devient **autonome** : ses décisions s'appliquent directement dans son thème.
5. Les admins gardent le dernier mot : ils peuvent remettre en essai, retirer un curateur, ou annuler un marché.

### Actions faites côté serveur avec la clé service role

- **Réinitialiser un mot de passe** : l'admin entre le nom d'utilisateur, le serveur génère un mot de passe temporaire (ex. `Kitoko-4821-Mbote`) et le change dans Supabase Auth. L'utilisateur le change ensuite dans « Mon profil ».
- **Suspendre / réactiver un compte** : suspension Supabase Auth (la session déjà ouverte expire en moins d'une heure).

Ces deux actions vérifient d'abord `est_admin()` et sont écrites dans `journal_admin`.

### Premier admin

Un compte devient admin avec cette requête dans le SQL Editor de Supabase (remplacer le nom) :

```sql
update public.utilisateurs set role = 'admin' where lower(nom_utilisateur) = lower('Mon_Nom');
```

Ensuite, les autres admins se nomment depuis le panneau (Utilisateurs → Rôle).

## Back-office admin (étape 3, suite)

Migration : `supabase/migrations/20261107110000_backoffice_admin.sql`. Style des écrans : DESIGN.md, section « Panneau admin ».

### Statuts d'un marché (complet)

```
Créé par l'admin :      brouillon ──► programme ──► approuve (« En ligne ») ──► ferme ──► regle
                             └──────────────────────► approuve (publié tout de suite)
Proposé par un membre : en_attente ──► approuve │ refuse
À tout moment avant le règlement :  ──► supprime (toutes les mises en cours remboursées)
```

« En ligne » s'appelle toujours `approuve` dans la base (le nom n'a pas été changé pour ne pas casser les fonctions des étapes 2 et 3). Un marché n'est **jamais effacé** : « supprimer » le passe en `supprime`, il disparaît du site et les mises sont remboursées.

Nouvelles colonnes de `marches` : `date_publication`, `soki_programme` (devient Soki du jour à la publication), `mis_en_avant` (en tête de liste sur l'accueil), `cree_par`, `modele_id`.

### Nouvelles tables

| Table | Rôle | Qui peut lire | Qui peut écrire |
| --- | --- | --- | --- |
| `reglages` | Règles du jeu modifiables, avec minimum et maximum : `bonus_inscription` (1 000), `bonus_quotidien` (100), `serie_longueur` (7), `bonus_serie` (200), `bonus_question_approuvee` (50), `limite_mise_quotidienne` (2 000), `mise_minimum` (10), `seuil_essai_curateur` (10), `propositions_en_attente_max` (5), `ajustement_max` (100 000), `whatsapp_equipe` | Tout le monde (règles publiques) | `modifier_reglage()` (admin) |
| `modeles_recurrents` | Marchés récurrents : question (avec `{date}`), catégorie, source, chaque jour ou chaque semaine, heure de Kinshasa, durée d'ouverture, option Soki, actif, prochaine publication | Admins | Fonctions SQL (admin) |
| `ajustements_pieces` | Historique des ajouts / retraits de pièces par un admin : compte, montant, raison, solde avant / après, lot (bonus en masse), auteur | Admins | `ajuster_pieces()` |

`journal_admin` gagne `avant`, `apres` (JSON des valeurs modifiées) et `txid`.

### Fonctions SQL

| Fonction | Rôle |
| --- | --- |
| `reglage(cle)` | Valeur d'un réglage. **Toutes les fonctions des pièces lisent maintenant les réglages** (inscription, bonus, série, question approuvée, limite, mise minimum, seuil curateur, propositions en attente) |
| `modifier_reglage(cle, valeur, texte)` | Dans les limites ; journalisé avec avant / après |
| `creer_marche_admin(…, etat, date_publication, mis_en_avant, soki)` | `brouillon`, `programme` ou `en_ligne` ; pas de file d'approbation, pas de bonus de +50 |
| `modifier_marche_admin(…)` | **Tant qu'il n'y a aucune mise : tout. Après la première mise : seulement la date de fin et la mise en avant** (`verrouille_mises`) |
| `changer_etat_marche(marche, action)` | `publier`, `programmer`, `brouillon`, `fermer` |
| `mettre_en_avant()`, `dupliquer_marche()` (copie en brouillon), `supprimer_marche(marche, motif)` (remboursement), `mises_en_cours()` (pour la confirmation) | |
| `creer_modele_recurrent()`, `activer_modele()` | Modèles récurrents |
| `generer_recurrences()`, `publier_marches_programmes()` | Lancées **chaque minute par pg_cron** (`kongox-publier-marches`) : crée les occurrences des 24 prochaines heures en `programme`, publie celles dont l'heure est arrivée ; un marché `soki_programme` devient le Soki du jour |
| `ajuster_pieces(utilisateur, montant, raison)` | Type de transaction `ajustement_admin`, via `mouvement_pieces()`. Raison obligatoire, jamais sur soi-même, solde jamais négatif, plafond `ajustement_max` |
| `bonus_en_masse(cible, noms, montant, raison)` | Cibles : `liste` de noms, `actifs_7j`, `actifs_30j` (jamais soi-même, 1 à 10 000 pièces, 5 000 comptes maximum). Communauté et classement : étape 4 |
| `tableau_de_bord()`, `series_tableau_de_bord(jours)` | Chiffres du jour et séries par jour (7, 30 ou tout). **Compte actif** = a reçu le bonus de connexion ou a misé ce jour-là |
| `journaliser()` (remplacée), `journaliser_detail()` | Journal avec avant / après. Des déclencheurs sur `marches` et sur le rôle / les badges d'un utilisateur enregistrent les valeurs modifiées ; `journaliser()` donne son nom à la ligne (ex. `marche_approuve`) au lieu d'en écrire une deuxième. Les actions de pg_cron ne sont pas journalisées |

Toutes ces fonctions vérifient `est_admin()` (fonction interne `exiger_admin()`) et renvoient un code d'erreur dans `hint` (`verrouille_mises`, `solde_negatif`, `hors_limites`…).

### Textes de l'application et réglages

Les montants dans `messages/fr.json` s'écrivent avec des marqueurs : « [[bonus_inscription]] pièces offertes ». Au chargement des textes (`src/i18n/request.ts`), ils sont remplacés par la valeur du réglage (« 1 000 »). Les réglages sont mis en cache et rafraîchis dès qu'un admin en modifie un (`updateTag("reglages")`).

### Écrans du back-office

Les textes du panneau admin (outil interne, en français) sont écrits directement dans les composants `src/components/admin/` et les pages `src/app/admin/`, sans passer par `messages/fr.json` ; seuls les messages d'erreur des fonctions SQL y restent (`erreursAdmin`). Les tableaux trient, filtrent et paginent par l'adresse ; l'export CSV passe par `src/app/admin/export/[type]/route.ts` (vérifie `est_admin()`, séparateur `;`).

## Football, classements, profils (étape 4)

Migration : `supabase/migrations/20261107120000_football_classements_profils.sql`.

### Matchs et import

| Table | Rôle | Lecture | Écriture |
| --- | --- | --- | --- |
| `ligues` | Championnats importés (Premier League 39, Ligue des champions 2, Liga 140, Serie A 135, Bundesliga 78, Ligue 1 61, **Linafoot 424**), activables | Tout le monde | `activer_ligue()` (admin) |
| `equipes` | Équipes (nom, logo du fournisseur) | Tout le monde | Import |
| `matchs` | `date_match` (affichée), `date_api` (réelle), statut (`a_venir`, `en_cours`, `termine`, `annule`, `reporte`), score publié, dernière réponse du fournisseur (`statut_api`, `buts_*_api`), `marche_id` | Tout le monde | Import, `corriger_match()` (admin) |
| `appels_api` | Compteur de requêtes par jour (Kinshasa) et par fournisseur | Admins | `reserver_appel_api()` |
| `imports_football` | Journal des imports (type, statut, requêtes, matchs, message, déclencheur) | Admins | Import |

**Un marché « 1n2 » par match** (`marches.type_reponse = '1n2'`, options `1` / `N` / `2`, fermeture au coup d'envoi). Il réutilise la cagnotte, la limite quotidienne et le règlement exact.

**Import économe** (`src/lib/football/`, côté serveur, clé `API_FOOTBALL_KEY`) :
- Code indépendant du fournisseur : `types.ts` (format commun `MatchNormalise`), `apiFootball.ts` (adaptateur), `import.ts` (orchestration). Pour changer de fournisseur, on écrit un autre adaptateur.
- Matchs à venir : une fois par jour (si aucun import réussi depuis 20 h), 1 requête par ligue active, sur `football_jours_a_venir` jours.
- Résultats : seulement pour les matchs dont la fin estimée (coup d'envoi + 2 h) est passée et dont le score est inconnu, 20 matchs par requête, au plus toutes les 30 minutes par match.
- Avant chaque requête, `reserver_appel_api()` compte et **refuse au-delà de `api_football_limite_jour`** (90) : l'import s'arrête.
- Un seul import du même type à la fois (`commencer_import()`).
- Si le fournisseur ne répond pas : erreur notée dans le journal, les données déjà en base restent affichées.
- Déclenchement : à la visite de `/football` (après l'envoi de la page, au plus une vérification toutes les 10 minutes), par Vercel Cron en production (`vercel.json`, route `/api/cron/football` protégée par `CRON_SECRET`), et par le bouton « Importer maintenant » (Admin › Matchs).
- `appliquer_resultats()` (après chaque import et toutes les 5 minutes par pg_cron `kongox-resultats-matchs`) publie le score quand la fin estimée est passée et règle le marché (score à 90 minutes ; annulé ou reporté = remboursement).

**Mode test (saison 2024 gratuite)** : `football_saison` = 2024 et `football_decalage_jours` = 728 (104 semaines, pour garder les jours de la semaine). Les matchs de novembre 2024 sont rejoués aux mêmes jours de novembre 2026 ; le fournisseur connaît déjà les scores, mais ils ne sont publiés qu'à la fin estimée du match. Bandeau « Données de test 2024 » dans l'admin. En production : saison en cours et décalage 0 (voir AVANCEMENT.md, « Avant la mise en ligne »).

### Classements, abonnements, communautés

| Table | Rôle | Lecture | Écriture |
| --- | --- | --- | --- |
| `abonnements` | Qui suit qui | Tout le monde | `suivre(nom, oui/non)` |
| `communautes` | Villes, universités, fan-clubs (créées par un admin) | Tout le monde | `creer_communaute()` (admin) |
| `membres_communaute` | 3 communautés au maximum par personne | Tout le monde | `rejoindre_communaute()` |
| `duels_communautes` | « Communauté contre communauté » de la page Classement | Tout le monde | `creer_duel()`, `activer_duel()` (admin) |

`marches.communaute_id` (facultatif) prépare le filtre par communauté du fil de marchés.

- **Score Mayele** = prédictions justes ÷ prédictions réglées (gagnées ou perdues ; remboursées exclues), sur la période (semaine, mois, tout ; heure de Kinshasa, selon la date de règlement du marché). Il faut au moins `classement_min_predictions` (5) prédictions réglées pour être classé. Ordre : score, puis nombre de prédictions réglées, puis solde.
- `classement(periode, limite, amis)` (public ; `amis` = moi + ceux que je suis), `mon_classement(periode)`, `duels(periode)` : score d'une communauté = prédictions justes de tous ses membres ÷ prédictions réglées ; la barre montre la part de chaque communauté.
- `profil_public(nom)` et `predictions_publiques(nom, filtre)` : le profil public montre les prédictions d'un joueur (question, choix, mise, résultat). La table `predictions` reste privée : seules ces fonctions en publient un résumé.
- `bonus_en_masse` accepte maintenant les cibles `communaute` et `top` (N premiers du classement de la semaine, du mois ou depuis le début).
- `regler_marche_interne()` / `annuler_marche_interne()` : règlement sans contrôle admin, utilisé par les matchs ; `regler_marche()` (admin) l'appelle.

Nouveaux réglages : `football_saison`, `football_decalage_jours`, `football_jours_a_venir`, `api_football_limite_jour`, `classement_min_predictions`.

## Assistant IA (étape 5, première partie)

Migration : `supabase/migrations/20261107130000_assistant_ia.sql`. Code : `src/lib/ia/` et `src/app/api/assistant/route.ts`.

### Fonctionnement

1. Le navigateur (`src/components/ia/Assistant.tsx`) envoie à `POST /api/assistant` le marché regardé (ou rien, dans l'onglet Chat) et les derniers échanges (6 au maximum, 500 caractères par message). **L'historique reste dans le navigateur : aucun message n'est enregistré dans la base.**
2. La route vérifie la connexion (compte obligatoire), puis `reserver_question_ia()` compte la question : limite par personne (`ia_questions_par_jour`, 20) et plafond global (`ia_plafond_global_jour`, 2 000), jour de Kinshasa.
3. Elle construit le prompt système en deux blocs :
   - **partie fixe** (`src/lib/ia/prompt.ts` + exemples de `src/lib/ia/exemples.ts`), marquée `cache_control` (**prompt caching**) ; elle ne contient rien de variable ;
   - **partie variable** (`src/lib/ia/contexte.ts`) : date et heure à Kinshasa, le marché (question, source, fin, OUI/NON, volume, statut) ou le match (équipes, ligue, coup d'envoi, 1/N/2, volume, **forme récente** des deux équipes via `forme_equipe()`), ou, dans l'onglet Chat, les marchés les plus misés et les prochains matchs.
4. Appel à l'API Claude avec le SDK officiel `@anthropic-ai/sdk` (**côté serveur uniquement**, clé `ANTHROPIC_API_KEY`), modèle du réglage `ia_modele` (`claude-haiku-5-5`), effort `low`, 1 024 jetons au maximum, délai 30 s, une seule nouvelle tentative.
5. La réponse est renvoyée **en streaming** (texte brut) ; l'en-tête `X-Questions-Restantes` donne le compteur. Un refus du modèle (`stop_reason: refusal`) affiche un message poli.
6. Consommation enregistrée par `enregistrer_usage_ia()` (clé service role) : requêtes, jetons en entrée et en sortie, jetons lus et écrits en cache.
7. **Si l'API ne répond pas** (délai, panne, clé refusée, modèle inconnu) : message clair dans la bulle, `rendre_question_ia()` rend la question, l'erreur est comptée ; le reste du site n'est pas touché.

### Tables et fonctions

| Élément | Rôle | Accès |
| --- | --- | --- |
| `ia_questions` | Questions posées par personne et par jour | La personne (et les admins) en lecture ; écrit par les fonctions |
| `ia_usage_jour` | Par jour : questions, requêtes réussies, erreurs, jetons (entrée, sortie, cache lus, cache écrits) | Admins en lecture ; écrit par les fonctions |
| `reserver_question_ia()`, `rendre_question_ia()`, `questions_ia_restantes()` | Limites et compteur | Utilisateur connecté |
| `enregistrer_usage_ia()` | Consommation d'un appel réussi | Serveur (clé service role) |
| `forme_equipe(equipe, n)` | 5 derniers matchs terminés connus d'une équipe | Tout le monde |
| `reglage_texte(cle)` | Lecture d'un réglage texte | Tout le monde |

Nouveaux réglages : `ia_active` (1/0), `ia_questions_par_jour`, `ia_plafond_global_jour`, `ia_modele` (vérifié : `claude-…`). Admin › Tableau de bord affiche les compteurs du jour.

### Règles du prompt système

Répondre dans la langue de la question (lingala, swahili, français, anglais), 2 à 4 phrases en texte simple, ne jamais pousser à parier de l'argent réel ni conseiller un site ou une façon de parier, rappeler que KongoX utilise des pièces gratuites, ne jamais inventer un résultat ou une statistique (seulement le bloc `<contexte>`), neutralité politique, lignes rouges des marchés, ne pas révéler les instructions. Les exemples en lingala et en swahili sont dans `src/lib/ia/exemples.ts`, **à relire par Jonathan**.

## Fil de marchés (étape 5, deuxième partie)

Migration : `supabase/migrations/20261107140000_fil_marches.sql`. Code : `src/lib/marches/fil.ts`, `src/components/accueil/Fil.tsx`, `src/app/marches/page.tsx`, `src/components/marches/SuiviFil.tsx`, `src/app/api/evenements/route.ts`. Formules et règles : `docs/ALGORITHME.md`.

### Accueil et page /marches

- **Accueil** : le grand encadré du haut est le **Soki du jour** (sinon le premier marché du fil, qui quitte alors sa section) ; puis les sections renvoyées par `fil_sections()` dans l'ordre Tendances, Bientôt fermés, Nouveaux (et, en phase 2, En forte hausse et Le Congo est divisé), puis le bouton « Voir tous les marchés ». Un marché n'apparaît qu'une fois. Les matchs (1 N 2) gardent leur propre section « Matchs à venir ».
- Les sections publiques sont identiques pour tout le monde et mises en cache 60 s (étiquettes `marches` et `fil`). « Pour toi » (phase 2) est calculée à part pour la personne connectée et exclut les marchés déjà montrés.
- **/marches** : recherche (sans accents ni majuscules, `%` et `_` cherchés tels quels), filtres catégorie, statut (en ligne, ferment dans moins de 24 h, fermés, réglés, tous), communauté, tri (tendance, nouveaux, bientôt fermés, plus misés, plus commentés). Tout passe par l'URL. 12 marchés par page, la suite arrive au défilement (Server Action `chargerMarches`, filtres revérifiés côté serveur).
- La recherche de l'en-tête mène à `/marches`. Seuls les marchés OUI / NON sont dans le fil et sur `/marches`.

### Tables

| Table | Rôle | Accès |
| --- | --- | --- |
| `reglages_fil` | Coefficients (A, B, C, G, H, bonus nouveau, seuils de la phase 2), sections affichées (1) ou cachées (0), taille des sections, règle de diversité, durée « Bientôt fermés ». Chaque valeur a des limites. | Lecture pour tous ; modification par `modifier_reglage_fil()` (admin, journalisée) |
| `scores_marches` | Une ligne par marché OUI / NON en ligne : score de tendance, prédicteurs et pièces sur 24 h, commentaires, prédictions de la dernière heure, momentum, variation du OUI sur 24 h, controverse, date du calcul | Lecture pour tous ; écrite seulement par `calculer_scores_fil()` |
| `evenements_fil` | Événements `visite`, `affiche`, `clic`, `prediction`, avec section, position, page, utilisateur (s'il est connecté), visiteur et visite (identifiants aléatoires) | Admins en lecture ; écrite seulement par le serveur |

Colonne ajoutée : `marches.sponsor` (nom du partenaire ; la carte affiche alors « Sponsorisé »). La saisie arrivera avec la page partenaires (étape 6).

### Fonctions

| Fonction | Rôle | Accès |
| --- | --- | --- |
| `calculer_scores_fil()` | Recalcule tous les scores (tâche pg_cron `kongox-scores-fil`, toutes les 10 minutes ; aussi après un changement de coefficient et avec « Recalculer maintenant ») | Serveur seulement |
| `fil_sections(exclure)` | Sections de l'accueil (sans doublon, règle de diversité, épinglés en tête de Tendances) | Tout le monde |
| `fil_pour_toi(exclure)` | « Pour toi » (phase 2), vide si la section est cachée | Comptes connectés |
| `rechercher_marches(…)` | Recherche, filtres, tris et pages de `/marches` (48 au maximum par appel) | Tout le monde |
| `diversifier(ids, categories, taille)` | Au plus K marchés de la même catégorie dans les N premiers | Interne |
| `commentaires_marche(marche, depuis)` | Nombre de commentaires ; renvoie 0 jusqu'au chat (feat/chat la remplacera) | Interne |
| `enregistrer_evenements_fil(lot, utilisateur)` | Enregistre un lot (50 au maximum), ignore les événements invalides | Serveur (clé service role) |
| `indicateurs_fil(jours)` | Taux de clic par section, visites, prédictions par visite, retour J1 / J7, temps avant la première prédiction | Admins |

### Mesure sans ralentir la page

`SuiviFil` (monté une fois dans la mise en page, pas sur `/admin`) observe les cartes qui portent `data-fil-marche`, `data-fil-section` et `data-fil-position` : affichage quand la carte est visible à moitié (une fois par page), clic n'importe où sur la carte, une visite par onglet, et la prédiction réussie (rattachée à la section d'où venait le clic). Les événements sont groupés (toutes les 5 s ou par 30) et envoyés avec `navigator.sendBeacon` à `POST /api/evenements`, qui répond tout de suite (204) et enregistre après la réponse (`after()`). **Aucune donnée personnelle** : le visiteur est un identifiant aléatoire gardé dans le navigateur (`localStorage`), la visite un autre (`sessionStorage`). Les événements de plus de 180 jours sont effacés chaque nuit (`kongox-purge-evenements`).

## Tables prévues (étapes suivantes)

| Table | Rôle |
| --- | --- |
| `messages` | Messages du chat (match, marché, communauté) |
| `signalements` | Messages ou marchés signalés |

## Connexion (Supabase Auth)

- L'utilisateur ne donne qu'un nom d'utilisateur et un mot de passe.
- Dans Supabase Auth, le compte utilise une adresse cachée `nom@kongox.local`. Elle n'est **jamais affichée** dans l'interface.
- La confirmation par e-mail est **désactivée** dans Supabase Auth.
- L'inscription passe par une Server Action : le compte est créé côté serveur avec la clé service role (`auth.admin.createUser`, compte confirmé tout de suite), puis l'utilisateur est connecté.
- Si l'utilisateur ajoute plus tard un vrai e-mail dans son profil, il va dans la colonne `coordonnees_utilisateurs.email_contact`, **pas** dans Auth. Les coordonnées sont dans une table séparée pour que le profil public ne les montre jamais.
- Réglages Supabase (Authentication › Sign In / Providers) : fournisseur **Email activé** (nécessaire pour la connexion par mot de passe), **Confirm email désactivé**, **Allow new users to sign up désactivé** (les comptes ne se créent que par le serveur KongoX ; le déclencheur refuse aussi toute autre adresse).
- Un compte créé à la main dans le tableau de bord Supabase est refusé par le déclencheur : créer les comptes (même admin) depuis le formulaire KongoX, puis changer le `role`.
- Mot de passe oublié : un admin réinitialise le mot de passe depuis le panneau admin, **côté serveur** avec la clé `SUPABASE_SERVICE_ROLE_KEY`.

## Rôles

| Rôle | Peut faire |
| --- | --- |
| `utilisateur` | Prédire, proposer, commenter, chatter |
| `curateur` | En plus : approuver, refuser ou corriger les questions de son thème (validées par un admin pendant l'essai, puis autonome) |
| `admin` | Tout : approuver, régler, annuler, Soki du jour, réinitialiser les mots de passe, suspendre, rôles, curateurs, cadeaux (modération du chat à l'étape 5) |

## Statuts d'un marché (questions de la communauté — voir aussi « Back-office admin »)

```
en_attente ──► approuve ──► ferme ──► regle
     │
     └──► refuse
```

## Parcours des pièces

1. **Inscription** : +1 000 pièces.
2. **Bonus quotidien et série** : +100 pièces par jour de connexion (une fois par jour, jour de Kinshasa). La colonne `serie_jours` compte les jours consécutifs ; elle est affichée sur l'accueil (« Série de 6 jours »). Tous les 7 jours de suite (7, 14, 21…), +200 pièces bonus en plus. Si l'utilisateur rate un jour, la série retombe à 0 avant de recompter.
3. **Question approuvée** : quand une question proposée passe à `approuve`, son auteur reçoit +50 pièces et le badge « Créateur de marché » (une seule fois par question).
4. **Mise** : les pièces passent du solde à la cagnotte du marché (minimum 10, limite de 2 000 par jour, jour de Kinshasa).
5. **Règlement** : la cagnotte est partagée entre les gagnants au prorata de leur mise (voir « Calcul des gains »). Annulation : remboursement.

La série (`serie_jours` et bonus de 7 jours) est construite à l'étape 1, avec le bonus quotidien. Le bonus est réclamé automatiquement à l'ouverture du profil (et plus tard de l'accueil) ; la fonction SQL refuse un deuxième bonus le même jour. Le bonus de question approuvée est construit à l'étape 2 (`approuver_marche`).

Chaque étape passe par une **fonction SQL en transaction**, qui écrit une ligne dans `transactions_pieces` et met à jour le solde en même temps. Le navigateur ne calcule jamais les pièces.

## Sécurité

- Row Level Security activée sur toutes les tables.
- La clé `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que côté serveur.
- Les mots de passe sont réinitialisés par un admin, après une demande par WhatsApp avec le nom d'utilisateur.
- Les numéros de téléphone ne sont visibles que par leur propriétaire et les admins.
