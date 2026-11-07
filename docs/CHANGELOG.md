# Historique des versions

Toutes les modifications importantes de KongoX sont notées ici, de la plus récente à la plus ancienne.

## [0.6.0] — 2026-11-07 — Étape 5 (première partie) : assistant IA

### Ajouté
- Assistant KongoX avec l'API Claude (`@anthropic-ai/sdk`, côté serveur), modèle `claude-haiku-5-5` modifiable dans Admin › Réglages, réponses en streaming, prompt caching de la partie fixe du prompt système
- Répond dans la langue de la question (lingala, swahili, français, anglais), réponses courtes, jamais d'encouragement à l'argent réel, rien d'inventé : contexte tiré de la base (marché ou match, pourcentages, forme récente des équipes)
- Sur la page de chaque marché et de chaque match, et dans l'onglet « Chat » (`/chat`) ; exemple de réponse en lingala et en français pour les visiteurs, avec « Crée ton compte — 1 000 pièces offertes »
- Limites : 20 questions par personne et par jour, plafond global par jour (réglables), messages polis au-delà ; question rendue si l'API ne répond pas
- Compteurs du jour (questions, requêtes, erreurs, jetons, cache) dans Admin › Tableau de bord
- Exemples de conversation en lingala et en swahili dans `src/lib/ia/exemples.ts` (à relire par Jonathan)

### Modifié
- Variable `AI_API_KEY` renommée `ANTHROPIC_API_KEY` (`.env.example`, README, CLAUDE.md)

## [0.5.0] — 2026-11-07 — Étape 4 : football, classements et profils

### Ajouté
- Import des matchs API-Football (Premier League, Ligue des champions, Liga, Serie A, Bundesliga, Ligue 1, **Linafoot**) : code indépendant du fournisseur, budget de requêtes par jour avec arrêt avant la limite, imports concurrents bloqués, site utilisable si l'API ne répond pas
- Mode test : saison 2024 (offre gratuite) rejouée avec un décalage de 728 jours ; saison et décalage dans Admin › Réglages ; bandeau « Données de test 2024 » dans l'admin
- Marché 1 N 2 automatique pour chaque match, réglé automatiquement après la fin estimée (score à 90 minutes) ; match annulé ou reporté = remboursement
- Page `/football` (par championnat et par jour), section « Matchs à venir » sur l'accueil, page d'un match (1 · équipe, N · nul, 2 · équipe, répartition des prédictions)
- Classements semaine / mois / depuis le début et entre amis, score Mayele, podium, « Toi », communauté contre communauté (`/classement`, section « Classement de la semaine » sur l'accueil)
- Profils publics `/u/[nom]` : badges, score Mayele, pièces, prédictions, abonnés, bouton Suivre, partage WhatsApp, prédictions récentes (toutes / en cours / terminées), communautés
- Communautés (3 par personne, à rejoindre dans le profil) et duels choisis par l'admin
- Admin › Matchs (ligues, « Importer maintenant », compteur de requêtes, journal des imports, saisie manuelle d'un score ou annulation), Admin › Communautés, compteur de requêtes sur le tableau de bord
- Bonus en masse : cibles « une communauté » et « les N premiers du classement »
- Variable `CRON_SECRET` et `vercel.json` (import quotidien en production)

### Corrigé
- Dates des entrées des étapes 3 et 4 et noms de trois migrations (avancés par erreur au 8, 9 et 10 novembre)

## [0.4.0] — 2026-11-07 — Étape 3 : admin et curateurs

### Ajouté
- Panneau admin `/admin` (maquette Admin) : file d'approbation avec délai et retard (12 h), approuver / modifier le texte / refuser avec motif ; résultats à régler avec lien source ; annulation avec remboursement ; Soki du jour
- Réinitialisation des mots de passe par nom d'utilisateur (mot de passe temporaire, clé service role côté serveur)
- Utilisateurs : recherche, fiche (solde, série, taux de réussite, coordonnées, transactions), rôle, suspension
- Cadeaux manuels : marquer un gagnant, « Envoyé » (numéro obligatoire), annuler, historique
- Curateurs : candidature sur `/curateur`, période d'essai avec validation des décisions par un admin, autonomie après 10 décisions validées, retrait
- Journal des actions admin (`journal_admin`)
- « Changer mon mot de passe » et lien vers le panneau dans le profil ; lien « Admin » dans l'en-tête
- Tables `curateurs`, `candidatures_curateur`, `decisions_curateur`, `cadeaux`, `journal_admin` avec RLS

### Ajouté (back-office)
- Nouveau style du panneau admin : sobre et dense (section « Panneau admin » de DESIGN.md), menu latéral, recherche globale, menu replié sur téléphone
- Tableau de bord : chiffres du jour et graphiques sur 7 jours, 30 jours ou tout
- Marchés : création directe par l'admin, modification (verrouillée après la première mise), publication, fermeture, mise en avant, Soki du jour, duplication, suppression avec remboursement automatique
- Programmation : brouillon → programmé → en ligne, vue liste et calendrier, marchés récurrents (chaque jour / chaque semaine), publication automatique chaque minute (pg_cron)
- Pièces : ajout / retrait avec raison obligatoire (`ajustement_admin`), bonus en masse (liste de noms, comptes actifs 7 / 30 jours), historique
- Journal : qui, quoi, quand, avant / après, filtres et export CSV
- Réglages : règles des pièces modifiables dans des limites ; les textes de l'application suivent les valeurs
- Tableaux avec tri, filtres, pagination et export CSV ; confirmation obligatoire avant toute action dangereuse

### Modifié
- `approuver_marche` et `refuser_marche` gèrent maintenant les curateurs (essai / autonome)
- Les fonctions des pièces lisent les réglages au lieu de valeurs écrites en dur
- « Mots de passe » est maintenant dans « Utilisateurs » (outil en haut de la liste et sur chaque fiche)

## [0.3.0] — 2026-11-07 — Étape 2 : marchés et prédictions

### Ajouté
- Tables `marches`, `options_marche`, `predictions` avec Row Level Security ; statuts `en_attente` → `approuve` / `refuse` → `ferme` → `regle`
- Système de cagnotte : mise, règlement avec partage exact de la cagnotte (aucune pièce perdue ni créée), remboursement si personne n'a gagné, annulation
- Limite de 2 000 pièces misées par jour (jour de Kinshasa) et mise minimum de 10 pièces
- +50 pièces et badge « Créateur de marché » quand une question est approuvée (fonction `approuver_marche`, écran admin à l'étape 3)
- Fermeture automatique des marchés échus toutes les 5 minutes (pg_cron)
- Page d'accueil ordinateur et mobile (hero, Soki du jour, bandeau défilant, marchés tendance filtrables, recherche, « Ce que pense Kinshasa », comment ça marche, partenaires), en-tête commun, barre du bas sur mobile
- Page d'un marché : graphique d'évolution du OUI (24 h / 14 j / tout), panneau de prédiction avec gain estimé, mes mises, partage WhatsApp
- Message « Fais une pause, reviens demain » après 3 pertes de suite
- Page « Proposer une question » avec aperçu en direct ; « Mes questions proposées » dans le profil
- Marchés d'exemple dans `supabase/seed.sql`
- Page « Cette page arrive bientôt » pour les liens des étapes suivantes
- Variable `NEXT_PUBLIC_SITE_URL`

### Modifié
- Les données publiques sont mises en cache 30 secondes et rafraîchies après chaque mise
- Seuls les textes utiles aux composants navigateur sont envoyés au téléphone

## [0.2.0] — 2026-11-06 — Étape 1 : connexion et pièces

### Ajouté
- Inscription et connexion par nom d'utilisateur + mot de passe (adresse cachée `nom@kongox.local`, jamais affichée), suggestions de noms drôles
- Pages `/inscription`, `/connexion` et `/profil` (solde, série, historique des pièces, téléphone et e-mail de contact facultatifs, déconnexion)
- Tables `utilisateurs`, `coordonnees_utilisateurs`, `transactions_pieces` avec Row Level Security
- Fonctions SQL : `mouvement_pieces()` (seul chemin des pièces), 1 000 pièces à l'inscription, bonus quotidien de 100 pièces, série de connexion (+200 pièces tous les 7 jours)
- Variable `NEXT_PUBLIC_WHATSAPP_EQUIPE` pour « Mot de passe oublié ? »

## [0.1.0] — 2026-11-06 — Étape 0 : création du projet

### Ajouté
- Projet Next.js 16 (App Router, TypeScript, Turbopack) avec Tailwind CSS v4
- Jetons de design de DESIGN.md dans `src/app/globals.css` : palette Fresh Greens, couleurs du thème clair et sombre, étiquettes de catégorie, rayons, ombres décalées, animations (coupées avec `prefers-reduced-motion`)
- Polices Space Grotesk et Inter (next/font, `display: swap`)
- Mode clair par défaut + mode sombre (classe `dark`, choix gardé dans `localStorage`, suit `prefers-color-scheme` au premier lancement) et bouton lune
- next-intl en français (`messages/fr.json`), fuseau horaire Africa/Kinshasa
- PWA : manifeste, icônes, service worker pour les notifications push (sans cache hors ligne)
- Clients Supabase : navigateur, serveur, admin (service role, serveur uniquement) et proxy qui rafraîchit la session
- En-têtes de sécurité (nosniff, DENY, Referrer-Policy)
- Page d'attente temporaire pour vérifier le thème (remplacée à l'étape 2)

## [0.0.1] — 2026-11-06

### Ajouté
- Cahier des charges du MVP
- Guide de design (palette Fresh Greens, fond blanc)
- 9 maquettes : accueil ordinateur et mobile, page d'un marché, inscription, proposer une question, profil, classement, partenaires, admin
- Règles du projet pour Claude Code (CLAUDE.md) et étapes de construction (PROMPTS.md)
