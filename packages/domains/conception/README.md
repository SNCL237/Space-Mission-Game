# `@smdg/conception`

Domaine pur de conception des missions. Il consomme C1 via `CATALOGUE_PORT` et
produit un C3 immuable ; il ne dépend pas du code des domaines CAT ou SCE.

## Couverture Mission Design Lab

| Discipline MDL      | Données et contrôle P3                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| Structures          | Masse sèche et compatibilité au lanceur (A1/A2)                            |
| Puissance           | Puissance consommée/produite, alertes et batterie d’éclipse (A1/A3)        |
| Propulsion          | Isp catalogue, marge Δv et carburant de Tsiolkovski (A1)                   |
| Communications      | Débit de données généré par les instruments (A1)                           |
| Coût                | Coût des équipements, lanceur et opérations (A1)                           |
| Fiabilité et risque | Fiabilité des éléments conservée dans C3 ; vérification de faisabilité RG1 |
| Thermique           | Hors périmètre : absence de données et de règle validée (Q-04)             |

Les paramètres techniques ajoutés au catalogue sont des valeurs de gameplay
`a-calibrer` jusqu’à validation de sources. Les paramètres propres à une mission
(Δv, durée, budget, temps d’observation et rendement batterie) sont fournis à
la création de la configuration.

La difficulté limite les composants et les objectifs secondaires : Découverte
autorise zéro, Ingénieur un et Expert deux. Zéro secondaire reste valide avec
un avertissement (Q-09). La maturité est calculée, sans statut persistant :
1 = objectifs choisis, 2 = validation de faisabilité, 3 = deux variantes
comparées, 4 = configuration C3 figée.

Chaque instrument doit être associé explicitement à au moins un objectif
sélectionné avant le gel de C3. C3 conserve cette association ainsi que les
missions réelles renseignées par le catalogue, sans déduire d'association.

## Vérification

```powershell
pnpm --filter @smdg/conception test
pnpm --filter @smdg/conception typecheck
pnpm --filter @smdg/conception build
```
