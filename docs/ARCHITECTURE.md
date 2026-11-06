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

Types de transaction actuels : `inscription`, `bonus_quotidien`, `bonus_serie`. Les étapes suivantes en ajouteront (mise, gain, question approuvée…) en modifiant la contrainte `transactions_type_valide`.

## Fonctions SQL (étape 1)

| Fonction | Rôle | Appelable par |
| --- | --- | --- |
| `mouvement_pieces(utilisateur, montant, type, description)` | **Seul chemin pour faire bouger des pièces** : met à jour le solde et écrit la ligne du journal dans la même transaction | Personne depuis l'API (fonctions SQL internes seulement) |
| `creer_profil_utilisateur()` | Déclencheur sur `auth.users` : crée le profil, les coordonnées vides et verse 1 000 pièces, dans la même transaction que le compte. Refuse tout compte dont l'adresse n'est pas `nom@kongox.local` | Déclencheur uniquement |
| `reclamer_bonus_quotidien()` | Bonus du jour et série (voir « Parcours des pièces ») ; verrouille la ligne pour éviter un double bonus | Utilisateur connecté |
| `nom_utilisateur_disponible(nom)` | Le nom est-il libre ? | Tout le monde |

## Tables prévues (étapes suivantes)

| Table | Rôle |
| --- | --- |
| `marches` | Questions : texte, catégorie, date de fin, source, statut, auteur |
| `options_marche` | Options d'un marché (OUI / NON ou choix multiples) et total misé |
| `predictions` | Mise d'un utilisateur sur une option |
| `matchs` | Matchs importés d'API-Football |
| `communautes` | Communautés et leurs curateurs |
| `membres_communaute` | Qui appartient à quelle communauté |
| `messages` | Messages du chat (match, marché, communauté) |
| `signalements` | Messages ou marchés signalés |
| `cadeaux` | Gagnants choisis par les admins, statut d'envoi |
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
| `curateur` | En plus : approuver ou refuser les marchés de son thème (après période d'essai) |
| `admin` | Tout : approuver, régler, réinitialiser les mots de passe, gérer les cadeaux, modérer |

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
4. **Mise** : les pièces passent du solde à la cagnotte du marché (limite de 2 000 par jour).
5. **Règlement** : la cagnotte est partagée entre les gagnants au prorata de leur mise.

La série (`serie_jours` et bonus de 7 jours) est construite à l'étape 1, avec le bonus quotidien. Le bonus est réclamé automatiquement à l'ouverture du profil (et plus tard de l'accueil) ; la fonction SQL refuse un deuxième bonus le même jour. Le bonus de question approuvée est construit à l'étape 2.

Chaque étape passe par une **fonction SQL en transaction**, qui écrit une ligne dans `transactions_pieces` et met à jour le solde en même temps. Le navigateur ne calcule jamais les pièces.

## Sécurité

- Row Level Security activée sur toutes les tables.
- La clé `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que côté serveur.
- Les mots de passe sont réinitialisés par un admin, après une demande par WhatsApp avec le nom d'utilisateur.
- Les numéros de téléphone ne sont visibles que par leur propriétaire et les admins.
