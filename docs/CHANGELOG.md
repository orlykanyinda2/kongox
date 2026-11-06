# Historique des versions

Toutes les modifications importantes de KongoX sont notées ici, de la plus récente à la plus ancienne.

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
