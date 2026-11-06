# Travailler à deux avec GitHub

Orly est au Canada, Jonathan à Kinshasa. GitHub garde une seule version du code en ligne. Chacun travaille sur son ordinateur, puis envoie et récupère les changements.

## Les mots à connaître

| Mot | Ce que ça veut dire |
| --- | --- |
| **Dépôt** (repository) | Le projet KongoX sur GitHub |
| **Commit** | Une sauvegarde avec un message (« feat: page classement ») |
| **Push** | Envoyer tes commits sur GitHub |
| **Pull** | Récupérer les commits de l'autre |
| **Branche** | Une copie de travail séparée, pour ne pas casser `main` |
| **Pull request (PR)** | Demander à fusionner sa branche dans `main`, après relecture |
| **Conflit** | Les deux ont modifié la même ligne : il faut choisir |

## Mise en place (une seule fois)

**Orly :**
1. Sur github.com, crée le dépôt **privé** `kongox`.
2. Dans *Settings › Collaborators*, invite le compte GitHub de Jonathan.
3. Pousse le projet (ou demande à Claude Code : « Connecte ce projet au dépôt GitHub [adresse] et pousse le code »).
4. Dans *Settings › Branches*, protège `main` : obligation de passer par une pull request.

**Jonathan :**
1. Accepte l'invitation reçue par e-mail.
2. Récupère le projet :
   ```bash
   git clone https://github.com/<compte>/kongox.git
   cd kongox
   npm install
   ```
3. Crée son propre `.env.local` (les clés ne passent jamais par GitHub : envoyez-les en privé).

## Le travail de tous les jours

```bash
# 1. Avant de commencer : récupérer le travail de l'autre
git checkout main
git pull

# 2. Créer une branche pour ta tâche
git checkout -b feat/assistant-ia

# 3. Travailler, puis sauvegarder souvent
git add .
git commit -m "feat: assistant IA en lingala"

# 4. Envoyer ta branche sur GitHub
git push -u origin feat/assistant-ia
```

5. Sur GitHub, clique sur **Compare & pull request**. Décris ce que tu as fait.
6. L'autre relit, teste et clique sur **Merge**.
7. Chacun refait `git checkout main` puis `git pull`.

Astuce : tu peux demander tout ça à Claude Code en français, par exemple « Crée une branche feat/classement », « Fais un commit et pousse », « Récupère les derniers changements de main ».

## Qui fait quoi (pour éviter les conflits)

| Orly (systèmes) | Jonathan (IA) |
| --- | --- |
| `feat/connexion`, `feat/admin` | `feat/assistant-ia` |
| Base de données, sécurité, hébergement | Données football, cotes et gains |

Ne travaillez pas en même temps sur le même fichier. Si c'est nécessaire, prévenez-vous sur WhatsApp.

## Suivre les tâches

- Onglet **Issues** : une tâche ou un bug = une issue (« Le bouton OUI ne marche pas sur mobile »). Assignez-la à quelqu'un.
- Onglet **Projects** : un tableau À faire / En cours / Terminé, pour voir l'avancement à deux.
- Dans un commit, écris `fix: … (#12)` pour lier une correction à l'issue n° 12.

## Gérer les versions

Quand une étape importante marche (par exemple la connexion et les pièces) :

1. Ajoute l'entrée dans `docs/CHANGELOG.md`.
2. Sur GitHub, ouvre *Releases › Draft a new release* et crée une étiquette (tag) : `v0.1.0`, `v0.2.0`…
3. Règle simple : `v0.x.0` pour une nouvelle étape, `v0.x.1` pour une correction, `v1.0.0` pour le lancement public.

Pour revenir à une ancienne version, chaque commit et chaque release reste visible sur GitHub. Rien n'est perdu.

## En cas de conflit

Git affiche les deux versions dans le fichier :

```
<<<<<<< HEAD
ta version
=======
la version de l'autre
>>>>>>> main
```

Garde la bonne version, supprime les marques, puis `git add .` et `git commit`. Ou demande à Claude Code : « Aide-moi à résoudre ce conflit ».

## Les règles d'or

1. Toujours `git pull` avant de commencer.
2. Jamais de travail directement sur `main`.
3. Commits petits et fréquents, avec des messages clairs.
4. Jamais de clés ni de `.env.local` sur GitHub.
5. La documentation se met à jour en même temps que le code.
