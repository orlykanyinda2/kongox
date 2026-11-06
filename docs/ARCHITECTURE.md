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

Migration : `supabase/migrations/20261108090000_admin_et_curateurs.sql`.

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

## Tables prévues (étapes suivantes)

| Table | Rôle |
| --- | --- |
| `matchs` | Matchs importés d'API-Football |
| `membres_communaute` | Qui appartient à quelle communauté |
| `messages` | Messages du chat (match, marché, communauté) |
| `signalements` | Messages ou marchés signalés |
| `abonnements` | Qui suit quel pronostiqueur |

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

## Statuts d'un marché

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
