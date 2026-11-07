# Tests de KongoX

Les tests vérifient la base de données (fonctions SQL, Row Level Security, pièces), les pages (rendu serveur, formulaires) et le code.
Ils tournent sur la **base Supabase de développement** : ils créent des comptes `Test_…` et des marchés `Test KongoX…`, puis les suppriment.
**Ne jamais les lancer sur la base de production.**

## Préparer

1. `.env.local` rempli à la racine (au minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Python 3.10 ou plus récent, et Node.js (le paquet `pg` est installé par `npm install`).
3. La variable `KX_DB_URL` : connexion PostgreSQL directe (Supabase › Project Settings › Database › Connection string, URI). Elle contient le mot de passe de la base : la mettre seulement dans la session du terminal, jamais dans un fichier envoyé sur GitHub.

```bash
# Git Bash
export KX_DB_URL="postgresql://postgres:<mot de passe>@db.<projet>.supabase.co:5432/postgres"
# PowerShell
$env:KX_DB_URL = "postgresql://postgres:<mot de passe>@db.<projet>.supabase.co:5432/postgres"
```

## Lancer

```bash
python tests/lancer.py              # code + base de données (environ 10 minutes)
npm run build
python tests/lancer.py --pages      # + pages : démarre le serveur sur le port 3123 s'il ne tourne pas
python tests/lancer.py --seul chat  # seulement les suites dont le nom contient « chat »
python tests/lancer.py --ia         # + assistant IA : vrais appels à l'API Claude (payant)
python tests/lancer.py --detail     # afficher chaque vérification
```

Chaque suite affiche `VERT` ou `ROUGE` ; en cas d'échec, les vérifications en échec sont listées. La base est nettoyée avant chaque suite et à la fin (`tests/outils/nettoyage.sql`).

## Contenu

| Dossier | Suites |
| --- | --- |
| `code/` | `test_requetes_predictions.py` : garde-fou, aucune requête « mes prédictions » sans filtre `utilisateur_id` (les prédictions sont publiques). Une requête volontairement sur toutes les prédictions porte le commentaire `// toutes-les-predictions : raison`. |
| `sql/` | Étapes 1 à 4, back-office, fil de marchés, chat, temps réel (Realtime), partage et partenaires, communauté (invités, votes publics, icônes, badges), assistant IA (`--ia`) |
| `pages/` | Pages publiques et admin de chaque étape, dont un vrai vote en invité et un vrai passage au compte par les formulaires, et `test_pages_mes_predictions.py` (chacun ne voit que ses mises) |
| `outils/` | `sql.cjs` (requêtes SQL avec `KX_DB_URL`) et `nettoyage.sql` |

Chaque suite peut aussi se lancer seule : `python tests/sql/test_chat.py .env.local tests/outils .`
