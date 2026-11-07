# Historique des versions

Toutes les modifications importantes de KongoX sont notées ici, de la plus récente à la plus ancienne.

## [0.10.0] — 2026-11-07 — Communauté : invités, votes publics, icônes, badges

### Ajouté
- Vote en invité : un pseudo suffit, 200 pièces d'essai, un invité par appareil, limite par adresse IP ; mention « invité » ; passage au compte en gardant votes, pièces et pseudo (+1 000 pièces) ; invité inactif 30 jours fermé (ses mises restent)
- Pour l'invité, « Crée ton compte » à la place de l'assistant, des commentaires, du bonus quotidien, des communautés, des cadeaux, de la boutique ; bandeau sous l'en-tête
- « Qui a voté » sur chaque marché et chaque match (icône, pseudo, choix, pièces, heure ; filtres et tri), « X personnes que tu suis ont voté » sur les cartes et les marchés, avertissement avant de voter sur un marché politique
- Icônes de profil : 30 icônes KongoX (gratuites, élite avec cadre spécial, boutique de 600 à 5 000 pièces gratuites), photo perso (recadrée, compressée, 500 Ko au maximum), signalement des photos ; page Profil › Mon icône
- Badges : 20 badges bronze / argent / or attribués automatiquement, « Nouveau badge ! », page `/badges` avec la progression, 4 badges mis en avant sur le profil
- Admin › Badges et icônes ; photos signalées dans Admin › Signalements

### Modifié
- Les prédictions sont publiques ; les classements ne comptent pas les invités
- Les icônes remplacent les initiales (profils, classement, commentaires)

## [0.9.0] — 2026-11-07 — Étape 6 : partage, partenaires et cadeaux

### Ajouté
- Boutons de partage : WhatsApp, Facebook, Telegram, TikTok (lien copié), copier le lien, menu de partage du téléphone, « Télécharger la carte » ; sur les pages d'un marché, d'un match, d'un profil, d'une communauté et sur le classement
- Cartes image générées (1200 × 630) pour chaque marché, chaque match, chaque profil et le site ; balises Open Graph et Twitter pour l'aperçu WhatsApp, Facebook et Telegram
- Page « Devenir partenaire de KongoX » (`/partenaires`, maquette Partenaires) : 7 offres, bouton WhatsApp, formulaire enregistré avec limites anti-abus
- Admin › Partenaires : suivi des demandes, note interne, compteur dans le menu
- Sponsor d'un marché (« Question offerte par… », mention « Sponsorisé ») et d'un cadeau (« offert par… »)
- Cadeaux : un cadeau par numéro, gagnants proposés depuis le classement, « Mes cadeaux » dans le profil, derniers gagnants sur le classement

## [0.8.0] — 2026-11-07 — Étape 5 (troisième partie) : chat et signalements

### Ajouté
- Salons de discussion en direct (Supabase Realtime) : un par marché (« Commentaires » sous le marché, badge OUI / NON de l'auteur), un par match (« Chat du match », badge 1 / N / 2), un par communauté (nouvelle page `/communautes/[id]`)
- Onglet Chat : l'assistant IA et la liste des salons (communautés, matchs à venir, marchés où ça discute)
- Envoi protégé : compte obligatoire, compte suspendu ou bloqué refusé, 500 caractères, un message toutes les 5 secondes et 20 en 10 minutes (réglables), liens retirés, mots interdits remplacés par des étoiles (sans accents ni majuscules)
- Bouton « Signaler » sur chaque message et « Signaler ce marché » ; masquage automatique après 3 signalements de personnes différentes
- Admin › Signalements : signalements ouverts, messages masqués (texte d'origine visible par les admins seulement), blocage du chat 24 h ou 7 jours, liste des mots interdits ; compteur dans le menu
- Les commentaires comptent dans le score de tendance (poids B) et le tri « plus commentés » de `/marches`

### Modifié
- Page introuvable : nouveau texte (« Page introuvable. »), bouton vers `/marches`
- Les noms des communautés (profil, profil public) mènent à leur page

## [0.7.0] — 2026-11-07 — Étape 5 (deuxième partie) : fil de marchés

### Ajouté
- Accueil en sections selon `docs/ALGORITHME.md` : Soki du jour (grand encadré), Tendances (6), Bientôt fermés (moins de 24 h), Nouveaux, puis « Voir tous les marchés » ; aucun marché en double ; les matchs gardent leur section
- Score de tendance calculé dans la base toutes les 10 minutes (pg_cron) avec les coefficients A, B, C, G, H et le bonus des nouveaux marchés ; épinglés en tête ; diversité (2 marchés de la même catégorie au plus dans les 6 premiers)
- Page `/marches` : recherche sans accents, filtres catégorie, statut et communauté, tris tendance, nouveaux, bientôt fermés, plus misés, plus commentés, chargement progressif au défilement
- Réglages du fil dans Admin › Réglages (coefficients, sections affichées ou cachées, diversité), bouton « Recalculer maintenant »
- Phase 2 préparée et cachée : momentum, variation du OUI et controverse calculés dès maintenant ; sections « Pour toi », « En forte hausse » et « Le Congo est divisé » prêtes à activer
- Mesure : table `evenements_fil` (affichage, clic, prédiction, visite, avec section et position), envoyée en arrière-plan, visiteurs anonymes avec un identifiant aléatoire ; indicateurs dans Admin › Tableau de bord (taux de clic par section, prédictions par visite, retour J1 et J7, temps avant la première prédiction)
- Mention « Sponsorisé » sur les cartes des marchés sponsorisés (colonne `marches.sponsor`)

### Modifié
- La recherche de l'en-tête et le lien « Marchés » mènent à `/marches` ; les puces de catégories de l'accueil sont remplacées par les filtres de `/marches`

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
