# Avancement de KongoX

Ce fichier dit où en est la construction. Claude Code le lit au début de chaque conversation et le met à jour à la fin de chaque étape de `PROMPTS.md`.

Statuts possibles : **à faire** · **en cours** · **terminé**

Dernière mise à jour : 2026-11-06

| | Étape | Contenu | Statut |
| --- | --- | --- | --- |
| [x] | 0 — Créer le projet | Next.js + TypeScript + Tailwind, next-intl (français), PWA, client Supabase, thème clair/sombre de DESIGN.md, Git + premier commit | terminé |
| [ ] | 1 — Connexion et pièces | Inscription / connexion par nom d'utilisateur, noms drôles, tables `utilisateurs` et `transactions_pieces`, 1 000 pièces à l'inscription, bonus quotidien de 100 pièces, série `serie_jours` (+200 pièces tous les 7 jours) | en cours |
| [ ] | 2 — Marchés et prédictions | Tables `marches`, `options_marche`, `predictions`, statuts, cagnotte, gains, bonus +50 pièces pour une question approuvée, accueil + page d'un marché + « Proposer une question », seed, limite de 2 000 pièces par jour | à faire |
| [ ] | 3 — Admin et curateurs | Panneau admin (file d'approbation, règlement, mots de passe, utilisateurs, cadeaux), rôles `admin` et `curateur`, période d'essai | à faire |
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
