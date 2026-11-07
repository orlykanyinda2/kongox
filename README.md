# KongoX — Reality. Probability. Insight.

**KongoX** est une application web de prédictions pour les jeunes Congolais, comme Polymarket mais avec des **pièces gratuites** et des sujets congolais : football, musique, politique et vie quotidienne.

Les utilisateurs prédisent avec des pièces gratuites, proposent leurs propres questions, montent au classement, gagnent de petits cadeaux et discutent en lingala, swahili ou français.

> Jamais d'argent réel. Les pièces ne s'achètent pas et ne s'encaissent pas.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Structure du projet](#structure-du-projet)
- [Documentation](#documentation)
- [Méthode de travail](#méthode-de-travail)
- [Équipe](#équipe)

## Fonctionnalités

- Inscription simple : nom d'utilisateur + mot de passe, noms drôles proposés
- Marchés communautaires OUI / NON proposés par les utilisateurs, approuvés sous 12 à 24 h
- Prédictions football 1 · N · 2 (Premier League, Ligue des champions, Liga, Serie A, Bundesliga, Ligue 1)
- Cotes par cagnotte : le pourcentage bouge avec la communauté
- Classements (semaine, mois, tout) et communauté contre communauté
- Profils, abonnements, curateurs et communautés
- Chat en direct et assistant IA multilingue
- Partage WhatsApp, Facebook, TikTok, Telegram
- Page partenaires et panneau admin

## Technologies

| Partie | Outil |
| --- | --- |
| Front-end | Next.js (App Router), TypeScript, Tailwind CSS |
| Application mobile | PWA installable |
| Back-end | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Langue | next-intl (français) |
| Données football | API-Football |
| Assistant IA | API d'un modèle de langage |
| Hébergement | Vercel + Supabase |

## Installation

Prérequis : [Node.js](https://nodejs.org) (version LTS), [Git](https://git-scm.com) et un projet [Supabase](https://supabase.com).

```bash
# 1. Récupérer le code
git clone https://github.com/<votre-compte>/kongox.git
cd kongox

# 2. Installer les dépendances
npm install

# 3. Créer le fichier des clés
cp .env.example .env.local
# puis remplir .env.local avec vos clés

# 4. Lancer en local
npm run dev
```

L'application s'ouvre sur http://localhost:3000.

Autres commandes : `npm run build` (version de production), `npm start` (lancer la version de production), `npm run lint` (vérifier le code).

## Variables d'environnement

Voir `.env.example`. Ne jamais envoyer `.env.local` sur GitHub (il est dans `.gitignore`).

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète Supabase (serveur uniquement) |
| `API_FOOTBALL_KEY` | Clé API-Football |
| `CRON_SECRET` | Secret de l'import planifié des matchs (route `/api/cron/football`, Vercel Cron) |
| `AI_API_KEY` | Clé de l'API de l'assistant IA |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site, pour les liens de partage (ex. `https://kongox.vercel.app`) |
| `NEXT_PUBLIC_WHATSAPP_EQUIPE` | Numéro WhatsApp de l'équipe (ex. `243812345678`), pour « Mot de passe oublié ? » |

## Structure du projet

```
kongox/
├── CLAUDE.md          Règles du projet (lues par Claude Code)
├── DESIGN.md          Guide de design
├── PROMPTS.md         Étapes de construction
├── README.md          Ce fichier
├── docs/              Documentation technique
├── maquettes/         Maquettes de référence (9 écrans)
├── messages/          Textes de l'interface (fr.json)
├── public/            Icônes de la PWA et service worker (sw.js)
├── src/
│   ├── app/           Pages, mise en page, manifeste, styles globaux (thème)
│   ├── components/    Composants réutilisables
│   ├── i18n/          Configuration de next-intl
│   ├── lib/           Supabase (navigateur, serveur, admin), thème
│   └── proxy.ts       Rafraîchit la session Supabase à chaque requête
└── supabase/
    ├── migrations/    Migrations SQL (à exécuter dans l'ordre)
    └── seed.sql       Marchés d'exemple (données fictives)
```

## Documentation

| Document | Contenu |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Règles absolues, fonctionnalités du MVP, conventions |
| [DESIGN.md](DESIGN.md) | Couleurs, polices, composants, animations |
| [PROMPTS.md](PROMPTS.md) | Les étapes de construction, à envoyer à Claude Code |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Base de données, rôles, flux des pièces |
| [docs/AVANCEMENT.md](docs/AVANCEMENT.md) | Où en est la construction (étapes 0 à 6) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Historique des versions |
| [docs/GITHUB.md](docs/GITHUB.md) | Travailler à deux avec GitHub : branches, pull requests, versions |
| [maquettes/](maquettes/) | Maquettes de chaque page |

## Méthode de travail

1. Une étape de PROMPTS.md à la fois.
2. Tester dans le navigateur.
3. Faire un commit avec un message clair, par exemple `feat: connexion par nom d'utilisateur`.
4. Pousser sur GitHub (`git push`).
5. Noter les changements dans `docs/CHANGELOG.md`.

Branches : `main` = version stable, une branche par fonctionnalité (`feat/chat`, `feat/admin`…), fusionnée par pull request après test. Le guide complet est dans [docs/GITHUB.md](docs/GITHUB.md).

## Équipe

- **Orly** — systèmes : base de données, connexion, admin, hébergement, sécurité
- **Jonathan** — IA : assistant IA, données football, cotes et gains

---

KongoX — jeu gratuit, aucune mise en argent réel.
