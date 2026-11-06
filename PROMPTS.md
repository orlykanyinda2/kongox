# KongoX — Messages à envoyer à Claude Code, étape par étape

Envoie un message à la fois. Teste dans le navigateur avant de passer au suivant. Après chaque étape qui marche, fais un commit Git.

## Étape 0 — Créer le projet

> Lis CLAUDE.md et DESIGN.md. Crée le projet Next.js (App Router, TypeScript, Tailwind CSS) dans ce dossier, avec next-intl en français par défaut, la configuration PWA et le client Supabase. Mets les couleurs, polices (Space Grotesk, Inter), rayons, ombres et animations de DESIGN.md dans la configuration Tailwind et un fichier CSS global, avec le mode clair et le mode sombre. Garde les fichiers README.md, .gitignore, .env.example et docs/ déjà présents. Initialise Git et fais le premier commit. Ne construis encore aucune page.

## Étape 1 — Connexion et pièces

> Construis l'étape 1 de CLAUDE.md, avec l'écran de maquettes/Inscription.dc.html : inscription et connexion par nom d'utilisateur et mot de passe (Supabase Auth), suggestions de noms drôles, profil avec e-mail et téléphone facultatifs. Crée les tables `utilisateurs` et `transactions_pieces` avec Row Level Security. 1 000 pièces à l'inscription et un bonus quotidien de 100 pièces, uniquement par des fonctions SQL en transaction. Écris la migration dans supabase/migrations.

## Étape 2 — Marchés et prédictions

> Construis l'étape 2 : tables `marches`, `options_marche` et `predictions`, les statuts du marché (en_attente, approuve, refuse, ferme, regle), le système de cagnotte et le versement des gains par fonction SQL. Fais la page d'accueil et la page d'un marché exactement comme dans maquettes/Main.dc.html, maquettes/Mobile.dc.html et maquettes/Marche.dc.html. Ajoute le formulaire « Proposer une question » comme dans maquettes/Proposer.dc.html. Ajoute les marchés d'exemple dans supabase/seed.sql. Applique la limite de 2 000 pièces misées par jour.

## Étape 3 — Admin et curateurs

> Construis l'étape 3 comme dans maquettes/Admin.dc.html : le panneau admin (file d'approbation des marchés sous 12 à 24 h, règlement avec lien source, réinitialisation des mots de passe par nom d'utilisateur, gestion des utilisateurs et des cadeaux). Ajoute les rôles `admin` et `curateur`, la candidature et la période d'essai des curateurs.

## Étape 4 — Football, classements et profils

> Construis l'étape 4 : import des matchs et résultats depuis API-Football (Premier League, Ligue des champions, Liga, Serie A, Bundesliga, Ligue 1), prédictions 1 N 2, classements semaine / mois / tous les temps avec le score Mayele, et les profils publics avec abonnements, comme dans maquettes/Classement.dc.html et maquettes/Profil.dc.html.

## Étape 5 — Chat et assistant IA

> Construis l'étape 5 : salons de chat par match, par marché et par communauté avec Supabase Realtime, bouton de signalement et filtre de mots. Ajoute l'assistant IA qui répond dans la langue de l'utilisateur (lingala, swahili, français, anglais) et ne pousse jamais à parier de l'argent réel.

## Étape 6 — Partage, partenaires et cadeaux

> Construis l'étape 6 : boutons de partage (WhatsApp, Facebook, TikTok, Telegram, copier le lien), cartes image générées pour chaque marché avec balises Open Graph, la page « Devenir partenaire de KongoX » comme dans maquettes/Partenaires.dc.html, et l'écran admin pour marquer les gagnants des cadeaux.

## Avant la mise en ligne

> Vérifie la sécurité : Row Level Security sur toutes les tables, aucune clé secrète côté client, limites de requêtes sur l'inscription et le chat. Prépare le déploiement sur Vercel.
