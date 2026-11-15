# Domaine CAM

CAM conserve les missions, l'état C4 sérialisé, la conception C3 figée, le
scénario et les versions utilisées. Il orchestre SCE, CON, SIM et EVA par leurs
ports, sans importer leur code.

Les actes avancent strictement de 0 à VI. L'acte III valide et fige C3 avant
de démarrer SIM ; les opérations sont enregistrées avec leurs effets et une
date. Le bilan est persisté avant la mise à jour des tentatives et l'évaluation
des conditions A10.

Les versions C2/C1 sont épinglées dès la création de la mission.
`reprendre` refuse une sauvegarde si une version épinglée manque et renvoie le
code nécessaire pour proposer un rejeu ; aucune migration silencieuse n'est
faite. Les événements du journal sont insérés dans une table append-only.

Les migrations CAM créent uniquement les tables du schéma `cam`, sans clés
étrangères inter-domaines.

Commandes :

- `pnpm --filter @smdg/campagne test`
- `pnpm --filter @smdg/campagne typecheck`
- `pnpm --filter @smdg/campagne build`
