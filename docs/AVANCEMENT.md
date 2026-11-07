# Avancement de KongoX

Ce fichier dit où en est la construction. Claude Code le lit au début de chaque conversation et le met à jour à la fin de chaque étape de `PROMPTS.md`.

Statuts possibles : **à faire** · **en cours** · **terminé**

Dernière mise à jour : 2026-11-07

| | Étape | Contenu | Statut |
| --- | --- | --- | --- |
| [x] | 0 — Créer le projet | Next.js + TypeScript + Tailwind, next-intl (français), PWA, client Supabase, thème clair/sombre de DESIGN.md, Git + premier commit | terminé |
| [x] | 1 — Connexion et pièces | Inscription / connexion par nom d'utilisateur, noms drôles, tables `utilisateurs` et `transactions_pieces`, 1 000 pièces à l'inscription, bonus quotidien de 100 pièces, série `serie_jours` (+200 pièces tous les 7 jours) | terminé |
| [x] | 2 — Marchés et prédictions | Tables `marches`, `options_marche`, `predictions`, statuts, cagnotte, gains, bonus +50 pièces pour une question approuvée, accueil + page d'un marché + « Proposer une question », seed, limite de 2 000 pièces par jour | terminé |
| [x] | 3 — Admin et curateurs | Panneau admin (file d'approbation, règlement, mots de passe, utilisateurs, cadeaux), rôles `admin` et `curateur`, période d'essai | terminé |
| [x] | 4 — Football, classements et profils | Import API-Football, prédictions 1 N 2, classements avec score Mayele, profils publics et abonnements | terminé |
| [x] | 5 — Chat et assistant IA | Salons Realtime (match, marché, communauté), signalement, filtre de mots, assistant IA multilingue (+ fil de marchés) | terminé |
| [x] | 6 — Partage, partenaires et cadeaux | Boutons de partage, cartes image + Open Graph, page partenaires, écran admin des cadeaux | terminé |

Après l'étape 6 : vérification de sécurité et déploiement (section « Avant la mise en ligne » de `PROMPTS.md`).

## Avant la mise en ligne

- [ ] Passer à l'**offre payante d'API-Football** (l'offre gratuite ne donne que les saisons 2022 à 2024).
- [ ] **Basculer la saison** dans Admin › Réglages : `football_saison` = saison en cours, `football_decalage_jours` = 0. Le bandeau « Données de test 2024 » disparaît alors de l'admin.
- [ ] Vérifier que la **Linafoot** (ligue n° 424) est bien importée avec la saison en cours.
- [ ] Vérification de sécurité et déploiement sur Vercel (PROMPTS.md, « Avant la mise en ligne »).
- [ ] Mettre la vraie adresse du site dans `NEXT_PUBLIC_SITE_URL` sur Vercel (liens de partage et images des aperçus WhatsApp).
- [ ] Renseigner le numéro WhatsApp de l'équipe dans Admin › Réglages (`whatsapp_equipe`) : bouton de la page partenaires et « Mot de passe oublié ? ».
- [ ] Pages en streaming : une adresse inconnue renvoie « introuvable » avec un code 200 (voir la note du chat).

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
- 2026-11-07 : `feat/connexion` et `feat/marches` fusionnées dans `main` (vérifié). Étape 3 terminée sur la branche `feat/admin`.
  - Migration de l'étape 3 exécutée sur Supabase. 42 tests SQL (curateurs, essai → autonome, cadeaux, rôles, RLS, journal) + 41 tests de l'étape 2 (non-régression) + 32 vérifications des pages admin (visiteur, utilisateur, curateur, admin) passent.
  - Aucun admin pour l'instant : voir « Premier admin » dans `docs/ARCHITECTURE.md`.
  - Reporté : signalements et modération du chat (étape 5), matchs (étape 4) — les écrans admin affichent « Cet écran arrive à l'étape… ».
- 2026-11-07 : panneau admin refait en back-office sobre (demande d'Orly), toujours sur `feat/admin`, avant la pull request.
  - Migration `20261107110000_backoffice_admin.sql` exécutée sur Supabase. 51 tests SQL du back-office + 42 (étape 3) + 41 (étape 2) passent ; 34 vérifications des écrans admin (admin, curateur, utilisateur, export CSV, textes réglés) + pages publiques passent.
  - Décisions validées par Orly : marché verrouillé après la première mise (sauf date de fin et mise en avant) ; bonus en masse par liste de noms ou comptes actifs (communauté et classement à l'étape 4) ; réglages des pièces modifiables.
  - Premier admin : `ondiq` (créé le 2026-11-07).
  - Reporté : un marché par match d'un championnat (étape 4, avec l'import des matchs) ; signalements (étape 5).
- 2026-11-07 : `feat/admin` (étape 3 + back-office) fusionnée dans `main` (pull request n° 3, vérifié). Étape 4 en cours sur `feat/football`.
  - API-Football : offre gratuite active (100 requêtes / jour) mais limitée aux saisons 2022 à 2024. Choix d'Orly : développer avec la saison 2024 (option C), passer à l'offre payante juste avant le lancement. Linafoot couverte (ligue n° 424, « Ligue 1 », Congo-DR).
  - Correction : les dates des entrées des étapes 3 et 4 (et les noms de trois migrations) avaient été avancées par erreur au 8, 9 et 10 novembre ; tout a été fait les 6 et 7 novembre 2026 (heure de Kinshasa). L'ordre des migrations est inchangé.
- 2026-11-07 : étape 4 terminée sur `feat/football`.
  - Migration exécutée sur Supabase. Premier import réel : 54 matchs (semaine du 9 au 16 novembre 2024, dont 12 de Linafoot ; pas de Ligue des champions cette semaine-là) pour 7 requêtes.
  - 39 tests SQL de l'étape 4 + non-régression (41 étape 2, 42 étape 3, 51 back-office) ; vérifications des pages football, accueil, classement, profils publics, page d'un match, admin › Matchs et Communautés.
  - À faire par Orly : créer les premières communautés et les duels dans Admin › Communautés.
  - Reporté : un marché par match d'un championnat dans les modèles récurrents (les marchés de matchs sont déjà créés automatiquement à l'import) ; forme récente des équipes pour l'assistant IA (étape 5, calculée depuis la table `matchs`).
- 2026-11-07 : `feat/football` fusionnée (pull request n° 4, vérifié). Nouvel ordre de travail d'Orly : une branche à la fois depuis `main` à jour, attendre « fusionné » avant la suivante : `feat/assistant-ia` → `feat/fil-marches` → `feat/chat` → `feat/partage` → avant la mise en ligne.
- 2026-11-07 : `feat/assistant-ia` prête.
  - Clé Anthropic vérifiée par un appel de test (réponse 200 ; elle ne commence pas par `sk-ant-api` mais l'API l'accepte).
  - Migration exécutée. Test de bout en bout avec de vrais appels : streaming, réponse en français avec les vrais pourcentages, réponse en lingala, refus de l'argent réel sans conseil de pari, prompt caching (jetons lus en cache), limite par personne, plafond global, panne simulée (clé invalide : message clair, question rendue, site intact), affichage visiteur / connecté / `/chat`. La clé n'est pas dans le code envoyé au navigateur.
  - À faire par Jonathan : relire les phrases en lingala et en swahili de `src/lib/ia/exemples.ts` et la qualité du lingala des réponses (quelques mots français mêlés).
- 2026-11-07 : `feat/assistant-ia` fusionnée (pull request n° 5, vérifié). `feat/fil-marches` prête.
  - Migration `20261107140000_fil_marches.sql` exécutée sur Supabase (tâches pg_cron `kongox-scores-fil` toutes les 10 minutes et `kongox-purge-evenements` chaque nuit).
  - 64 tests SQL (formule du score, bonus nouveau, controverse, variation, sections sans doublon, diversité, épinglé, sections cachées, phase 2, Pour toi, recherche, filtres, tris, pagination, événements, indicateurs, droits) et 29 vérifications des pages (accueil, `/marches`, `/api/evenements`, Admin › Réglages et Tableau de bord) passent ; non-régression des pages (étape 4, back-office, étape 2) ; suivi vérifié depuis un vrai navigateur.
  - Choix : bonus nouveau = 2 points (modifiable) ; sans Soki du jour, le premier marché du fil prend l'encadré ; « plus commentés » et le poids B restent à 0 jusqu'au chat (`commentaires_marche()` à remplacer dans `feat/chat`).
  - Reporté : saisie du sponsor d'un marché (étape 6, partenaires) ; tests A/B (phase 3).
- 2026-11-07 : `feat/fil-marches` fusionnée (pull request n° 6, vérifié). `feat/chat` prête : l'étape 5 est terminée.
  - Migration `20261107150000_chat.sql` exécutée sur Supabase (table `messages_chat` ajoutée à la publication Realtime).
  - 52 tests SQL / REST du chat (envoi, badge, filtre, limites, suspension, blocage, signalements, masquage automatique, modération, droits, RLS), test Realtime de bout en bout (message reçu en direct par un visiteur en moins d'une seconde), 22 vérifications des pages (marché, match, communauté, `/chat`, Admin › Signalements) ; non-régression : fil (64), étapes 2, 3, back-office, 4, pages des étapes précédentes.
  - Choix : les salons sont publics en lecture ; un salon par marché sert aussi de chat du match ; liens retirés des messages (anti-arnaque) ; texte d'un message masqué déplacé dans une table réservée aux admins.
  - À faire par Jonathan : ajouter les insultes courantes en lingala et en swahili dans Admin › Signalements › Mots interdits (la liste de départ est en français).
  - Reporté : pourcentages OUI / NON en direct avec Realtime (prévu à l'étape 2 ; aujourd'hui ils se mettent à jour à chaque visite) ; « en train d'écrire ».
  - Remarque pour « Avant la mise en ligne » : sur les pages en streaming (marché, profil, communauté), une adresse inconnue renvoie la page « introuvable » avec `noindex`, mais un code HTTP 200 (le 404 est dans le flux). Comportement de Next.js, à vérifier lors de l'audit.
- 2026-11-07 : `feat/chat` fusionnée (pull request n° 7, vérifié). `feat/partage` prête : l'étape 6 est terminée.
  - Migration `20261107160000_partage_partenaires.sql` exécutée sur Supabase.
  - 29 tests SQL / REST (demandes de partenariat et limites, sponsor, cadeaux, un cadeau par numéro, derniers gagnants sans numéro, droits) et 25 vérifications des pages (boutons de partage, cartes image PNG 1200 × 630, balises Open Graph dans `<head>` pour WhatsApp / Facebook / Telegram, `/partenaires`, Admin › Partenaires, Cadeaux, Marché, profil) ; cartes vérifiées à l'œil ; non-régression : chat, fil, back-office, étape 4, pages.
  - Choix : TikTok n'a pas de lien de partage web, le bouton copie le lien et la carte se télécharge ; un même compte peut gagner plusieurs cadeaux, mais un numéro ne sert qu'à un seul compte.
  - Non testé de bout en bout : l'envoi du formulaire partenaires depuis un navigateur (la fonction SQL et les limites sont testées).
- 2026-11-07 : `feat/partage` fusionnée (pull request n° 8, vérifié). Nouvel ordre d'Orly, avant « Avant la mise en ligne » : `feat/communaute`, puis `feat/motivation` (XP et niveaux, carte de victoire, notifications push).
- 2026-11-07 : `feat/communaute` prête.
  - Migration `20261107170000_communaute.sql` exécutée sur Supabase (stockage `avatars` créé ; tâches `kongox-fermer-invites` et `kongox-badges-classement`).
  - Décisions d'Orly : invité inactif 30 jours fermé plutôt que supprimé ; invités non classés ; bonus quotidien, abonnements et communautés réservés aux comptes (avec « Crée ton compte ») ; boutique de 500 à 5 000 pièces ; photos acceptées directement (signalement après coup).
  - 80 tests SQL / REST (invités, appareil et IP, conversion, fermeture, votes publics, badges, icônes, boutique, photos dans le stockage, pièces conservées) et 34 vérifications des pages, dont un vrai vote en invité et un vrai passage au compte par les formulaires ; planche des 30 icônes vérifiée à l'œil ; non-régression de toutes les suites.
  - Attention (sécurité) : les prédictions sont maintenant publiques ; deux requêtes qui comptaient sur la RLS pour lire « mes » prédictions ont été corrigées (filtre sur `utilisateur_id`).
  - À faire par Jonathan : proposer des icônes ou des noms d'icônes en lingala si besoin (`public/avatars/`, table `icones`).
  - Reporté : badges Parrain (le parrainage arrive avec `feat/motivation`) ; les icônes sont des dessins simples, qu'un graphiste pourra remplacer (mêmes noms de fichiers).
