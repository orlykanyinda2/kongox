# KongoX — Reality. Probability. Insight.

KongoX est une application web de prédictions pour les jeunes Congolais, comme Polymarket mais avec des **pièces gratuites** et des sujets congolais (football, musique, politique, prix, vie quotidienne). Le X veut dire Exchange, Experience, Explore.

Le cahier des charges complet (MVP) se trouve dans le document « KongoX MVP ». Ce fichier en résume les règles pour le code.

**Avancement :** au début de chaque conversation, lis `docs/AVANCEMENT.md`. Mets-le à jour à la fin de chaque étape.

**Design :** lis toujours `DESIGN.md` avant de créer une page ou un composant. Les maquettes de référence sont dans `maquettes/` : reproduis leur disposition, leur style, leurs couleurs et leurs animations.

| Fichier | Page |
| --- | --- |
| `Main.dc.html` | Accueil (ordinateur) |
| `Mobile.dc.html` | Accueil (mobile) |
| `Marche.dc.html` | Page d'un marché |
| `Inscription.dc.html` | Inscription et connexion |
| `Proposer.dc.html` | Proposer une question |
| `Profil.dc.html` | Profil d'un pronostiqueur |
| `Classement.dc.html` | Classement + communauté contre communauté |
| `Partenaires.dc.html` | Devenir partenaire |
| `Admin.dc.html` | Panneau admin (file d'approbation, mots de passe, cadeaux) |

Ce sont des maquettes : les données y sont fictives et en dur. Dans l'application, tout vient de Supabase.

## Règles absolues

- **Tout est en français** : interface, textes, messages d'erreur, commentaires du code, fichiers de documentation. Le chat et l'assistant IA acceptent toutes les langues (lingala, swahili, français, anglais).
- **Jamais d'argent réel** : les pièces ne s'achètent jamais et ne s'encaissent jamais. Aucune fonctionnalité de paiement pour miser.
- Les mouvements de pièces passent toujours par des **transactions PostgreSQL** (fonctions SQL), jamais par des calculs côté client. Une pièce ne doit jamais être perdue ni doublée.
- Mobile d'abord : petits téléphones Android, connexion lente. Pages légères, peu de JavaScript inutile.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PWA installable + notifications push web
- Supabase : PostgreSQL, Auth, Realtime (chat et pourcentages en direct), Storage
- Internationalisation : next-intl (français par défaut)
- Données foot : API-Football ou football-data.org
- Assistant IA : API d'un modèle de langage (Claude ou similaire)
- Hébergement : Vercel + Supabase cloud

## Fonctionnalités du MVP

1. **Inscription simple** : nom d'utilisateur + mot de passe seulement. Suggestions de noms drôles (ex. « Mayele_ya_Matonge », « Prono_King243 »). E-mail et téléphone facultatifs ; le téléphone est requis seulement pour recevoir un cadeau (un cadeau par numéro).
2. **Mot de passe oublié** : l'utilisateur contacte l'équipe avec son nom d'utilisateur ; un admin réinitialise depuis le panneau admin.
3. **Pièces** : 1 000 à l'inscription, bonus de connexion quotidien (ex. 100), bonus d'invitation, de partage et de séries de victoires. Limite quotidienne de mise.
4. **Matchs** : Premier League et Ligue des champions d'abord, puis Liga, Serie A, Bundesliga, Ligue 1. Heures de Kinshasa (Africa/Kinshasa).
5. **Prédictions foot** : 1 / N / 2 avec des pièces, gains versés automatiquement après le match.
6. **Marchés communautaires** : questions OUI/NON (et plus tard à choix multiples) proposées par les utilisateurs, avec date de fin et source. Statuts : `en_attente` → `approuve` / `refuse` → `ferme` → `regle`. Examen sous 12 à 24 heures.
7. **Cotes** : système de cagnotte (pari mutuel). Le pourcentage OUI/NON = part des pièces de chaque côté. Les gagnants se partagent la cagnotte au prorata de leur mise.
8. **Classements** : semaine, mois, tous les temps, entre amis, et communauté contre communauté.
9. **Profils** : taux de réussite, historique, abonnements aux pronostiqueurs.
10. **Curateurs et communautés** : candidature, période d'essai (approbations validées par un admin), puis approbation autonome dans leur thème. Les admins gardent le dernier mot.
11. **Chat** : salon par match, par marché et par communauté (Supabase Realtime), signalement, filtre de mots. **Assistant IA** qui répond dans la langue de l'utilisateur et ne pousse jamais à parier de l'argent réel.
12. **Partage** : bouton de partage partout (WhatsApp, Facebook, TikTok, Telegram, copier le lien), cartes image générées, balises Open Graph pour l'aperçu WhatsApp.
13. **Page partenaires** : « Devenir partenaire de KongoX », liste des façons de collaborer, boutons vers WhatsApp ou un formulaire.
14. **Cadeaux** : manuels. L'admin marque un gagnant, l'équipe envoie le crédit à la main. Pas d'envoi automatique pour l'instant.
15. **Panneau admin** : matchs, résultats, file d'approbation des marchés, règlement avec lien source, réinitialisation des mots de passe, utilisateurs, cadeaux, modération du chat.

## Règles des marchés

- Tous les sujets sont autorisés, y compris la politique.
- La réponse doit être claire et vérifiable (source + date de fin).
- Lignes rouges : aucun marché sur la mort, les blessures ou une attaque contre quelqu'un, et aucun qui vise des particuliers.

## Protection contre l'addiction

- Limite quotidienne de pièces misées.
- Message bienveillant après une série de pertes (« Fais une pause, reviens demain. »).
- Mention visible : « Jamais d'argent réel. »

## Ordre de construction

1. Connexion par nom d'utilisateur + pièces
2. Marchés + prédictions + gains
3. File d'approbation admin
4. Classements + profils
5. Chat + assistant IA
6. Cartes de partage + page partenaires + gestion des cadeaux

## Documentation (à tenir à jour)

- Après chaque étape terminée : ajoute une entrée dans `docs/CHANGELOG.md` (date, ce qui a été ajouté ou corrigé).
- Quand tu crées ou modifies une table, un rôle ou une règle des pièces : mets à jour `docs/ARCHITECTURE.md`.
- Quand tu ajoutes une variable d'environnement : ajoute-la dans `.env.example` et dans le tableau du `README.md`.
- Toute la documentation est en français.

## Git

- Messages de commit courts et clairs : `feat: …` (nouveauté), `fix: …` (correction), `docs: …` (documentation).
- Ne jamais committer `.env.local` ni aucune clé.
- Ne jamais travailler directement sur `main` : une branche par fonctionnalité, fusion par pull request (voir `docs/GITHUB.md`).
- Seule exception : à l'étape 0, le premier commit se fait sur `main`. Ensuite, une branche par étape (`feat/connexion`, `feat/marches`, `feat/admin`…), fusionnée dans `main` par pull request.
- L'équipe : Orly (systèmes, au Canada) et Jonathan (IA, à Kinshasa).

## Conventions

- Noms de tables et de colonnes en français, en snake_case (ex. `utilisateurs`, `marches`, `predictions`, `transactions_pieces`).
- Row Level Security activée sur toutes les tables Supabase.
- Les secrets (clés API) restent dans `.env.local`, jamais dans le code.
