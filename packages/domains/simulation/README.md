# Domaine SIM

Moteur pur de simulation déterministe : lancement, opérations journalières,
énergie, données, science, événements, fiabilité, crises A9 et reprise d’état.
Il consomme C3 et les définitions d’événements C2 ; il publie les événements
C9 depuis son adaptateur NestJS. Aucun domaine voisin n’est importé.

Le profil d’exploitation de C3 contient les paramètres qui ne sont pas définis
par les contrats historiques. Le moteur refuse une configuration qui n’en
fournit pas assez ; les paramètres de gameplay sont marqués `a-calibrer`.

L’état sérialisé contient l’état courant de Mulberry32 : la reprise conserve
exactement la suite aléatoire sans recalculer tous les tirages antérieurs. Le
risque accru A9 multiplie le taux de panne par `1 + penaliteRisqueAccru`, un
paramètre explicitement calibrable.

`test/fixtures/lro-like.json` est un profil synthétique de liaison
100 Mbit/s × 6 h/jour, soit 2 160 Gbit/jour. Les cas 461 et 572 Gbit/jour
vérifient uniquement le calcul et ne constituent pas une mesure de mission LRO.

Commandes :

- `pnpm --filter @smdg/simulation test`
- `pnpm --filter @smdg/simulation typecheck`
- `pnpm --filter @smdg/simulation build`
