# Algorithme du fil de marchés

Ce document explique comment KongoX choisit les marchés montrés à chaque utilisateur. Il doit être mis à jour quand une formule ou un coefficient change.

## Principe

Le fil n'utilise pas un seul algorithme : il est fait de **sections**, chacune avec sa propre règle. Les règles de diversité, d'épinglage et de sponsoring s'appliquent à toutes.

Les scores sont calculés **dans la base**, toutes les 10 minutes (pg_cron), jamais à chaque visite.

## Phases

| Phase | Quand | Sections |
| --- | --- | --- |
| **MVP** | Maintenant | Soki du jour · Tendances · Bientôt fermés · Nouveaux |
| **Phase 2** | ~1 000 utilisateurs actifs | + Pour toi · En forte hausse · Le Congo est divisé |
| **Phase 3** | ~10 000 et plus | + Exploration (bandits) · Filtrage collaboratif · Apprentissage automatique |

Chaque section peut être activée ou désactivée dans Admin › Réglages, sans toucher au code.

## Sections du MVP

### Soki du jour
Choisi par un admin (ou programmé). Un seul à la fois.

### Tendances (score « hot »)

```
activite = predicteurs_uniques_24h × A + commentaires_24h × B + pieces_misees_24h / C
score_tendance = activite ÷ (heures_depuis_publication + 2) ^ G
              + bonus_nouveau (pendant les H premières heures)
```

| Coefficient | Valeur de départ | Rôle |
| --- | --- | --- |
| A | 3 | Poids des personnes (le plus important, pour qu'un gros joueur seul ne pousse pas un marché) |
| B | 2 | Poids des commentaires |
| C | 100 | Pièces divisées par C |
| G | 1,5 | Vitesse de vieillissement |
| H | 6 h | Durée du bonus pour les nouveaux marchés |

### Bientôt fermés
Marchés en ligne qui se ferment dans moins de 24 h, du plus proche au plus lointain.

### Nouveaux
Ordre chronologique, du plus récent au plus ancien.

## Règles communes

- **Diversité** : au maximum 2 marchés de la même catégorie dans les 6 premiers d'une section.
- **Épinglés** : un marché épinglé par un admin reste en tête de Tendances.
- **Sponsorisés** : toujours affichés avec la mention « Sponsorisé ».
- **Pas de doublon** : sur l'accueil, un marché n'apparaît que dans une seule section (ordre : Soki du jour, Tendances, Bientôt fermés, Nouveaux).
- Seuls les marchés au statut `approuve` (en ligne) sont montrés.

## Phase 2 (préparée, désactivée)

- **Pour toi** : marchés des catégories où l'utilisateur prédit le plus, de ses communautés et des pronostiqueurs qu'il suit, triés par score de tendance.
- **En forte hausse** : `momentum = predictions_derniere_heure ÷ moyenne_horaire_7_jours`, et/ou forte variation du pourcentage OUI sur 24 h.
- **Le Congo est divisé** : `controverse = (1 − |p − 0,5| × 2) × predicteurs_uniques`, où p est le pourcentage OUI.

## Phase 3 (plus tard, avec Jonathan)

- **Exploration** : montrer une petite part de nouveaux marchés à un échantillon d'utilisateurs, puis pousser ceux qui sont joués (Thompson sampling).
- **Filtrage collaboratif** : « les gens qui ont prédit comme toi ont aussi joué… ».
- **Apprentissage automatique** : un modèle qui apprend à classer à partir des événements enregistrés.

## Mesure

Chaque affichage et chaque clic sur un marché est enregistré dans `evenements_fil` (utilisateur ou visiteur anonyme, marché, section, position, type : `affiche` / `clic` / `prediction`).

Indicateurs suivis dans Admin › Tableau de bord :

| Indicateur | Définition |
| --- | --- |
| Taux de clic par section | clics ÷ affichages |
| Prédictions par visite | prédictions ÷ visites |
| Retour J1 / J7 | part des utilisateurs revenus le lendemain / 7 jours après |
| Temps avant la première prédiction | après l'inscription |

Pour comparer deux réglages, on fera des tests A/B : chaque utilisateur est placé dans un groupe (A ou B) et on garde le réglage qui donne les meilleurs chiffres.
