# Avancement de KongoX

Ce fichier dit où en est la construction. Claude Code le lit au début de chaque conversation et le met à jour à la fin de chaque étape de `PROMPTS.md`.

Statuts possibles : **à faire** · **en cours** · **terminé**

Dernière mise à jour : 2026-11-08

| | Étape | Contenu | Statut |
| --- | --- | --- | --- |
| [x] | 0 — Créer le projet | Next.js + TypeScript + Tailwind, next-intl (français), PWA, client Supabase, thème clair/sombre de DESIGN.md, Git + premier commit | terminé |
| [x] | 1 — Connexion et pièces | Inscription / connexion par nom d'utilisateur, noms drôles, tables `utilisateurs` et `transactions_pieces`, 1 000 pièces à l'inscription, bonus quotidien de 100 pièces, série `serie_jours` (+200 pièces tous les 7 jours) | terminé |
| [x] | 2 — Marchés et prédictions | Tables `marches`, `options_marche`, `predictions`, statuts, cagnotte, gains, bonus +50 pièces pour une question approuvée, accueil + page d'un marché + « Proposer une question », seed, limite de 2 000 pièces par jour | terminé |
| [x] | 3 — Admin et curateurs | Panneau admin (file d'approbation, règlement, mots de passe, utilisateurs, cadeaux), rôles `admin` et `curateur`, période d'essai | terminé |
| [ ] | 4 — Football, classements et profils | Import API-Football, prédictions 1 N 2, classements avec score Mayele, profils publics et abonnements | à faire |
| [ ] | 5 — Chat et assistant IA | Salons Realtime (match, marché, communauté), signalement, filtre de mots, assistant IA multilingue | à faire |
| [ ] | 6 — Partage, partenaires et cadeaux | Boutons de partage, cartes image + Open Graph, page partenaires, écran admin des cadeaux | à faire |

Après l'étape 6 : vérification de sécurité et déploiement (section « Avant la mise en ligne » de `PROMPTS.md`).

## Notes

- 2026-11-06 : lecture de tous les fichiers du projet. Aucun code écrit. Le dossier n'est pas encore un dépôt Git.
- 2026-11-06 : décisions prises avec Orly :
  - Git : premier commit sur `main` à l'étape 0, puis une branche par étape, fusion par pull request.
  - Auth : adresse cachée `nom@kongox.local`, confirmation par e-mail désactivée, vrai e-mail dans `email_contact`, réinitialisation par un admin côté serveur.
  - Design : barre OUI verte sur fond brique (pas d'orange). Contour 2 px `#1F3A26` partout, en-tête compris. `#DDE5D0` seulement pour les séparateurs.
  - Pièces : série `serie_jours` avec +200 pièces tous les 7 jours de suite, construite à l'étape 1 avec le bonus quotidien ; +50 pièces et badge « Créateur de marché » pour une question approuvée, à l'étape 2.
  - Maquettes visuelles : https://claude.ai/artifact/23w7mVUdLg3sxVy6qAK5Co
- 2026-11-06 : étape 0 terminée. Next.js 16.4.5, Tailwind v4 (jetons dans `src/app/globals.css`, pas de `tailwind.config`), next-intl 4, Supabase SSR. `npm run lint` et `npm run build` passent. Premier commit sur `main`. Prochaine étape : 1, sur la branche `feat/connexion`.
- 2026-11-06 : `main` poussé sur GitHub (https://github.com/orlykanyinda2/kongox). Étape 1 en cours sur la branche `feat/connexion` : code écrit, build OK. Reste : exécuter la migration dans Supabase, régler Auth (Email activé, inscriptions publiques désactivées), tester.
- 2026-11-06 : étape 1 terminée. Migration exécutée dans Supabase. 24 tests automatiques passent (inscription +1 000, bonus une fois par jour, série et +200 au 7e jour, solde = somme des transactions, aucune écriture de pièces possible depuis le navigateur, coordonnées privées). Page /profil vérifiée avec une vraie session. Reste à faire par Orly : tester dans le navigateur, désactiver « Allow new users to sign up » dans Supabase, puis pull request `feat/connexion` → `main`.
- 2026-11-07 : étape 2 terminée sur la branche `feat/marches`. ATTENTION : la PR `feat/connexion` n'était pas fusionnée dans `main` sur GitHub au moment de commencer ; `feat/marches` part donc de `feat/connexion`. Fusionner `feat/connexion` d'abord, puis `feat/marches`.
  - Migrations de l'étape 2 et `seed.sql` déjà exécutés sur Supabase (10 marchés d'exemple, cagnottes à zéro).
  - 41 tests automatiques des fonctions SQL passent (mises, limite, approbation +50, règlement avec arrondi exact, remboursement, annulation, sécurité, conservation des pièces) ; pages vérifiées en visiteur et connecté.
  - Reporté : écran admin pour approuver / régler (étape 3) ; pourcentages en temps réel avec Supabase Realtime, assistant IA et commentaires sur la page d'un marché (étape 5) ; « Matchs à venir » et « Classement de la semaine » sur l'accueil (étape 4) ; cartes image et Open Graph (étape 6).
  - À vérifier par Jonathan : les phrases en lingala de la carte de l'assistant sur l'accueil (`messages/fr.json`, `accueil.assistant…`).
- 2026-11-08 : `feat/connexion` et `feat/marches` fusionnées dans `main` (vérifié). Étape 3 terminée sur la branche `feat/admin`.
  - Migration de l'étape 3 exécutée sur Supabase. 42 tests SQL (curateurs, essai → autonome, cadeaux, rôles, RLS, journal) + 41 tests de l'étape 2 (non-régression) + 32 vérifications des pages admin (visiteur, utilisateur, curateur, admin) passent.
  - Aucun admin pour l'instant : voir « Premier admin » dans `docs/ARCHITECTURE.md`.
  - Reporté : signalements et modération du chat (étape 5), matchs (étape 4) — les écrans admin affichent « Cet écran arrive à l'étape… ».
