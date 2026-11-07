# KongoX — Guide de design

Ce fichier décrit le design de KONGOX. Claude Code doit le suivre pour toutes les pages. La maquette de référence (accueil ordinateur, accueil mobile, page d'un marché) se trouve dans le canevas « KONGOX — Maquette page d'accueil ».

## Style général

- **Moderne, audacieux, congolais** : grands titres serrés, cartes arrondies avec **contour épais vert forêt (2 px) et ombre décalée pleine** (ex. `6px 6px 0`), formes qui flottent, couleurs franches.
- **Message direct** : vert = OUI, rouge brique = NON. Le visiteur comprend sans lire.
- **Mobile d'abord** : tout doit marcher à 360 px de large sur un petit Android.
- **Léger** : pas de grosses images de fond. Icônes en SVG fin (style Lucide), jamais d'emoji.
- **Tout en français** dans l'interface. Le logo s'écrit **KongoX**, le X dans une pastille vert-jaune.
- **Mode clair par défaut + mode sombre** (bouton lune). Choix gardé dans `localStorage`, suit `prefers-color-scheme` au premier lancement.

## Couleurs — palette « Fresh Greens »

### Couleurs de la marque

| Nom | Hex | Usage |
| --- | --- | --- |
| Vert forêt (encre) | `#1F3A26` | Texte principal, contours, boutons sombres |
| Hunter Green | `#386641` | Blocs foncés : carte assistant, panneau de mise, bandeau défilant, partenaires |
| Sage Green | `#6A994E` | Ombres décalées, barres de pourcentage, formes de fond |
| Yellow Green | `#A7C957` | Couleur d'action : OUI, pastille du titre, pièces, X du logo |
| Blanc | `#FFFFFF` | Fond des pages et des cartes |
| Vert très clair | `#F1F5E8` | Champs, puces, zones douces |
| Champagne Mist | `#F2E8CF` | Texte sur fond foncé (mode sombre, bulles) |
| Blushed Brick | `#BC4749` | NON, « Soki du jour », point « En direct », ombres d'accent |

### Couleurs du thème

| Jeton | Clair | Sombre |
| --- | --- | --- |
| `--fond` | `#FFFFFF` | `#13241A` |
| `--entete` | `#FFFFFF` | `#1A3121` |
| `--surface` | `#FFFFFF` | `#1F3A26` |
| `--doux` | `#F1F5E8` | `#2A4A31` |
| `--texte` | `#1F3A26` | `#F2E8CF` |
| `--texte-secondaire` | `#4B5A44` | `#C9D4B8` |
| `--contour` | `#1F3A26` | `#6A994E` |
| `--separateur` | `#DDE5D0` | `#386641` |
| `--ombre` | `#6A994E` | `#0C1810` |
| `--oui-fond` / `--oui-texte` | `#A7C957` / `#1F3A26` | `#A7C957` / `#1F3A26` |
| `--non-fond` / `--non-texte` | `#BC4749` / `#FFFFFF` | `#BC4749` / `#FFFFFF` |

### Étiquettes de catégorie

| Catégorie | Fond | Texte |
| --- | --- | --- |
| Football | `#D8E8C0` | `#2B4F33` |
| Musique | `#F6D9D5` | `#8E2F31` |
| Politique | `#E4DCC4` | `#4A3F1E` |
| Vie quotidienne | `#EAF2DA` | `#386641` |

Règle : OUI et NON portent toujours leur mot écrit, jamais la couleur seule.

## Animations

Courtes et légères, toutes coupées si `prefers-reduced-motion: reduce` :

- Titre qui monte (`translateY(28px)` → 0, 0,8 s), pastille « Prouve-le. » qui rebondit.
- Formes de fond qui flottent (6–9 s) ou tournent (18 s).
- Barre du OUI qui se remplit (1,6 s).
- Bulles de chat qui apparaissent une par une, trois points « en train d'écrire ».
- Point rouge « En direct » qui pulse.
- Bandeau des marchés qui défile en continu (38 s).

## Typographie

- **Titres** : Space Grotesk, graisse 700, interlignage serré (0,98 à 1,15), lettrage légèrement resserré (-1 à -2 px sur les grands titres).
- **Texte** : Inter, graisses 400 à 700.
- Les deux viennent de Google Fonts (`display=swap`).

| Élément | Taille mobile | Taille ordinateur |
| --- | --- | --- |
| Titre du hero | 40–44 px | 84 px max (`clamp(44px, 6vw, 84px)`) |
| Titre de section | 22–26 px | 40 px |
| Question d'un marché (carte) | 17 px | 20 px |
| Grand pourcentage | 40–44 px | 56 px |
| Texte courant | 14–15 px | 16–19 px |
| Petites infos (dates, volume) | 12 px | 13 px |

## Formes et espaces

- **Rayons** : boutons et champs 12–14 px, cartes 18–20 px, grandes cartes et bandeaux 24–28 px, puces et étiquettes 999 px.
- **Espaces** : grille de 4 px. Écarts entre cartes 16 px, marges de page 18 px (mobile) et 24 px (ordinateur), sections espacées de 56–64 px.
- **Largeur max du contenu** : 1280 px, centré.
- **Zones de clic** : 44 px minimum de haut (boutons principaux 52–56 px).
- **Contours et ombres** : contour 2 px `#1F3A26` + ombre pleine décalée sans flou (`4px 4px 0` mobile, `6–12px` ordinateur) en sage `#6A994E` ou brique `#BC4749`. Ce contour 2 px `#1F3A26` (`--contour`) est le style de la marque : cartes, boutons, pastilles et en-tête. La couleur `#DDE5D0` (`--separateur`) sert seulement aux séparateurs fins et aux bordures discrètes (lignes de liste, filets entre sections). Les cartes du hero sont légèrement penchées (-2,5° et 2°).

## Composants

1. **En-tête** : logo KongoX (le X dans une pastille vert-jaune), liens Marchés / Football / Classement / Partenaires, recherche, solde de pièces (pastille jaune), bouton lune (mode sombre), bouton vert « Créer un compte ». Collant en haut, avec une bordure basse de 2 px `#1F3A26` sur toutes les pages (même si une maquette montre une bordure plus claire).
2. **Hero** : fond blanc, formes flottantes, badge « Jamais d'argent réel » avec point qui pulse, titre centré géant « Le Congo a un avis. » + pastille vert-jaune « Prouve-le. », deux boutons, puis deux cartes penchées (« Soki du jour » et l'assistant qui parle lingala), et un bandeau vert foncé qui fait défiler les marchés.
3. **Carte de marché** : étiquette de catégorie, délai de fermeture, question, barre de pourcentage (partie OUI en vert `#A7C957` ou `#6A994E`, sur fond rouge brique `#BC4749` pour le NON ; pas d'orange), boutons OUI · xx % et NON · xx %, volume de pièces, nombre de commentaires, bouton de partage.
4. **Puces de catégories** : Tous, Football, Musique, Politique, Vie quotidienne. La puce active est vert forêt (vert-jaune en mode sombre).
5. **Carte de match** : championnat, heure de Kinshasa, équipes, trois boutons 1 · N · 2 avec leurs pourcentages.
6. **Classement** : rang (médailles or, argent, bronze), @nom, taux de réussite, pièces.
7. **Bloc « Ce que pense Kinshasa »** : fond vert-jaune, ombre brique, grande citation de pourcentage, bouton vert forêt « Partager sur WhatsApp ».
8. **Page d'un marché** : question, graphique d'évolution du OUI (ligne verte), panneau Hunter Green pour prédire (choix OUI/NON, montant avec puces 50 / 100 / 200 / 500, gain possible en vert-jaune, gros bouton vert-jaune « Valider »), mention « Jamais d'argent réel », bouton partage WhatsApp, assistant IA (bulles de chat), commentaires avec badge OUI/NON.
9. **Accueil mobile** : commence aussi par le titre « Le Congo a un avis. » + pastille « Prouve-le. », le badge « Jamais d'argent réel » et le bouton « Commencer », avant la série de connexion et le « Soki du jour ».
10. **Barre du bas sur mobile** : Accueil, Foot, bouton central vert-jaune « + » (proposer une question), Classement, Chat.
11. **Bandeau partenaires** : fond Hunter Green, titre, boutons vert-jaune « Voir toutes les offres » et contour « Devenir curateur ».

## Pièces

Icône : cercle vert-jaune `#A7C957` avec un anneau intérieur `#1F3A26`. Toujours écrire « pièces » après un montant (« 1 250 pièces »). Les nombres utilisent l'espace comme séparateur de milliers (« 48 920 »).

## Accessibilité

- Contraste du texte d'au moins 4,5:1 (les couleurs ci-dessus respectent cette règle).
- Vrais éléments `<button>`, `<a>`, `<input>` avec `<label>`. `aria-label` sur les boutons icône seuls.
- `aria-pressed` sur les puces et les choix OUI/NON.

## Panneau admin

Le panneau admin (`/admin`) ne suit **pas** le style ludique de l'application publique. C'est un back-office : sobre, professionnel et efficace. La maquette `maquettes/Admin.dc.html` donne le contenu (file d'approbation, mots de passe, cadeaux), pas le style.

### Style

| Élément | Règle |
| --- | --- |
| Fond | Blanc `#FFFFFF` ; zones (menu, en-têtes de tableau, filtres) en gris très clair `#F7F8F6` |
| Texte | `#1F3A26` ; texte secondaire `#5B6B57` |
| Bordures | Fines, 1 px `#E3E7DF` |
| Accent | Une seule couleur pour les boutons principaux et les liens actifs : `#386641` |
| Danger | Rouge `#BC4749` **seulement** pour les actions dangereuses (supprimer, suspendre, retirer des pièces, annuler) |
| Police | Inter uniquement (pas de Space Grotesk), 13 à 15 px, texte dense et lisible ; titres de page 20–22 px |
| Rayons | 6 à 8 px |
| Interdit | Ombres décalées, cartes penchées, animations, formes décoratives, mode sombre |
| Graphiques | Une série par graphique (petits multiples, jamais deux axes), ligne 2 px Sage `#6A994E` (validée : contraste et saturation suffisants ; `#386641` est trop gris pour une donnée), grille 1 px `#E3E7DF`, info-bulle au survol, tableau des valeurs disponible |

Jetons Tailwind : `adm-fond`, `adm-zone`, `adm-texte`, `adm-secondaire`, `adm-bordure`, `adm-accent`, `adm-danger`, `adm-graphique`.

### Structure

- Menu latéral fixe à gauche ; barre du haut avec la recherche globale (utilisateur, marché) et le nom de l'admin connecté.
- Sur tablette, tout fonctionne ; sur téléphone, le menu se replie derrière un bouton « Menu ».
- Menu : Tableau de bord · Marchés · Programmation · File d'approbation · Résultats à régler · Utilisateurs · Pièces · Cadeaux · Curateurs · Signalements · Journal · Réglages. Un curateur ne voit que la file d'approbation de ses thèmes.

### Données

- Les listes sont des **tableaux** : tri par colonne, filtres, recherche, pagination, export CSV.
- Tri, filtres et pages passent par l'adresse (`?tri=…&page=…`) : on peut partager un lien vers une vue, et la page reste légère.
- Nombres alignés à droite, séparateur de milliers « 48 920 », dates à l'heure de Kinshasa.

### Actions

- **Confirmation obligatoire** avant toute action dangereuse, dans une fenêtre qui rappelle les conséquences (« 34 mises seront remboursées »).
- Chaque action affiche un message court de réussite ou d'erreur, à côté du bouton.
- Toutes les actions sont écrites dans le journal (qui, quoi, quand, avant / après).

## Données d'exemple pour le développement

Pour la page d'accueil, utilise des marchés d'exemple dans chaque catégorie, par exemple :

- Football : « Les Léopards vont-ils se qualifier pour la CAN 2027 ? », « TP Mazembe gagnera-t-il le championnat Linafoot cette saison ? »
- Musique : « Fally Ipupa sortira-t-il un nouvel album avant juin 2027 ? »
- Politique : « Le Parlement votera-t-il le budget 2027 avant le 31 décembre ? »
- Vie quotidienne : « Le dollar dépassera-t-il 3 000 FC au marché avant février ? », « Y aura-t-il plus de 3 coupures de courant à Limete cette semaine ? »

Ces données sont fictives. Mets-les dans un fichier de seed (`supabase/seed.sql`), jamais en dur dans les composants.
