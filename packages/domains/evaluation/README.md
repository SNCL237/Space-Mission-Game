# Domaine EVA

EVA consomme C2, C3 et C4 via les contrats partagés ; elle n'importe pas SIM.
`evaluerBilan` calcule le C5 et la fin à partir des règles du scénario.
`ServiceEvaluation` publie `BilanPublié` une seule fois par mission dans
l'instance du service. Le suivi d'idempotence est en mémoire ; la persistance
multi-instance relève de CAM.

## Conventions A7

- La science répartit 60 % sur l'objectif principal et 40 % à parts égales
  entre les objectifs secondaires. Sans secondaire, le principal reçoit 100 %.
- La technique utilise les observations quotidiennes C4 : disponibilité =
  fraction des sous-systèmes qui ne sont pas `horsLigne` ; chaque marge est un
  ratio normalisé dans `[0, 1]` (batterie au-dessus du seuil critique, stockage
  libre, Δv restant, carburant restant). Le score vaut `250 × moyenne` des
  moyennes disponibilité et marges quotidiennes.
- Les ressources suivent A7 : moitié crédit budgétaire inutilisée, moitié
  fraction des données générées qui n'a pas été perdue.
- La fiabilité applique `R(t) = Π exp(−t / MTBFᵢ)` aux systèmes de C3 ; le
  risque accru applique la pénalité configurée si une décision `poursuivre` a
  été prise.
- En solo, les plafonds des quatre composantes hors collaboration sont
  multipliés par `1000/900`; `collab` vaut zéro. C5 v1 reste lisible et C5 v2
  marque explicitement le mode et garantit l'additivité des composantes.
- Les comparables réels sont exclusivement les noms `missionsReelles` déjà
  fournis par C1 et conservés dans C3. Le rapport est déterministe et exporté
  en JSON ; aucune mission ni valeur comparative n'est inventée.

Commandes :

- `pnpm --filter @smdg/evaluation test`
- `pnpm --filter @smdg/evaluation typecheck`
- `pnpm --filter @smdg/evaluation build`
