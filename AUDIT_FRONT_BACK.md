# Audit backend ↔ frontend — THE LAST LIGHT

*15 novembre 2026. Méthode : lecture du code ET exécution réelle (PostgreSQL 16 local, serveur NestJS démarré, parcours HTTP complet rejoué).*

## 0. Verdict

Le backend est **solide sur le plan technique** : 140 tests verts, architecture par domaines, validation Zod partout, simulation déterministe, physique documentée, référence GMAT. Mais :

1. **Il ne parle pas le même contrat que le frontend.** Aucun appel du frontend ne fonctionne tel quel : il faut une couche d'intégration complète.
2. **Il contient 5 défauts bloquants** pour une partie jouée de bout en bout (§3).
3. **Les données NASA réelles sont stockées, mais presque jamais utilisées par la simulation** (§4).
4. **Son contenu narratif contredit le GDD et le Parcours** (§2.3).

## 1. Le dépôt lui-même

| Problème | Effet | Correction |
|---|---|---|
| Le `package.json` racine est celui de l'ancien frontend (React, Vite) ; `src/`, `index.html` et `.env.example` de la racine aussi | `pnpm -r build` échoue (`Cannot find name 'crypto'`) : `@types/node` et `vitest` manquent pour `kernel`, `evaluation`, `pedagogie` | Rétablir un `package.json` racine de monorepo et retirer les fichiers du frontend |
| `pnpm-lock.yaml` épingle pnpm 12.18 | Installation en pnpm 10 seulement en `--no-frozen-lockfile` | Aligner la version de pnpm (champ `packageManager`) |

Après réparation : **build OK, 140 tests OK** (13 suites).

## 2. Contrat : ce que le frontend appelle et ce que le backend expose

### 2.1 Transport

| | Frontend | Backend |
|---|---|---|
| Préfixe | `{VITE_API_URL}/campaigns/...` | `/api/...` (en français) |
| Authentification | cookies (`credentials: 'include'`) | **JWT `Authorization: Bearer`** ; invité via `POST /api/identite/invites` (jeton valable 30 jours) |
| Erreurs | texte libre | `{ code, params, statut }` (codes seulement, aucun texte joueur) |
| CORS | — | `CORS_ORIGINS` + `credentials: true` : OK |

### 2.2 Routes

| Besoin du frontend | Appel frontend | Équivalent backend | État |
|---|---|---|---|
| Dernière sauvegarde | `GET /campaigns/latest` | `GET /api/campagne/missions` (page) | adaptable |
| Nouvelle campagne | `POST /campaigns {mode}` | `POST /api/conception/configurations` **puis** `POST /api/campagne/missions` (configuration obligatoire) | adaptable, ordre différent |
| Posture initiale (P07) | `PUT …/narrative/initial-stance` | **absent** | manque |
| Profil scientifique (P08) | `PUT …/profile` | `PATCH /api/conception/configurations/:id {type:"objectifs"}` | adaptable |
| Catalogue (P09) | interne | `GET /api/catalogue/:version` | **403 pour un joueur : réservé à l'admin** |
| Atelier (P09) | interne | `PATCH … ajouter-element / retirer-element / ajouter-instrument …` → réponse avec `bilans`, `erreurs`, `alertes`, `disponible` | bon |
| Prévalidation (P10) | interne | `erreurs` / `alertes` de la configuration ; **pas d'acceptation d'avertissement tracée** (`EVT-A2-003`) | partiel |
| Lancement (P11-P12) | interne | `PATCH {type:"lancement"}` + `POST …/actes {acte:3}` | bon |
| Cycles (P13-P15) | interne | `POST …/simulation {commandes, jours}` → `etatSimulation` | bon, mais **JSON dans une chaîne** |
| Crise (P16-P19) | interne | `POST …/crise {choix, cibleId?}` ; 5 choix, équivalents à ceux du frontend | bon |
| Rapport et fin (P20-P22) | `GET/POST /reports` | `POST …/cloturer` → bilan sur 1000 | **erreur 500 possible** (§3) |
| Événements `EVT-…` | `POST …/events` | **absent** : le backend journalise ses propres décisions (`journal`) | manque |
| Visualisation 3D | interne | `GET …/vue` (C10 : 720 positions, chronologie, scène 3D) | bon, à exploiter |
| Points de reprise | local | `GET …/reprise` | partiel |
| Glossaire | local | `GET /api/pedagogie/glossaire` | bon |

### 2.3 Contenu : le scénario backend contredit le GDD et le Parcours

| Élément | GDD / Parcours (frontend) | Scénario `lune-polaire` (backend) |
|---|---|---|
| Fins | Legacy Lives On · Fragment of Hope · Last Signal · Silence of Space | A « La Glace Confirmée » · B « Un Résultat Solide » · C « La Mission Écourtée » · D « L'Échec Utile » |
| Rôles | Maya ingénieure système · Daniel directeur · Noah responsable scientifique · Amara opérations et communications | Maya responsable de mission · Daniel ingénieur systèmes · Noah ingénieur données · Amara ingénieure instruments |
| Objectifs | 4 (cartographie, glace, thermique, composition) | 3 (glace, ombre permanente, cycle thermique) |
| Score | /100 (frontend) — les documents hésitent entre 100 et 1000 | /1000 : science 300, technique 250, ressources 200, fiabilité 150, équipe 100 |
| Budget | 340 M€ (frontend, illustratif) | 100 M$ |
| Anomalie | scénarisée (cycle 5) | aléatoire, avec graine fixe |

## 3. Défauts bloquants, constatés à l'exécution

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| B1 | **Catalogue illisible pour un joueur** | `GET /api/catalogue/1.1.0` → `403 ROLE_INTERDIT` | bloque l'atelier |
| B2 | **Les paramètres de simulation viennent du client** (`profilOperations` : fiabilité de chaque système, temps de contact, facteurs de crise…), et la simulation refuse de tourner sans eux | `PROFIL_OPERATIONS_REQUIS` ; un client peut envoyer une fiabilité de 1 000 000 de jours | casse l'autorité du serveur, triche triviale |
| B3 | **Clôture → 500** quand aucune des 4 fins ne s'applique | `ErreurEvaluation: AUCUNE_FIN_SCENARIO_SATISFAITE` (science à 47 %, mission non perdue) | partie impossible à terminer |
| B4 | **La validation de puissance ignore l'ombre** | config validée (158 W produits pour 117 W consommés) ; batterie de 400 Wh à 3 Wh dès le jour 1, tous les systèmes « critiques » au jour 25 | toute configuration valide meurt |
| B5 | Avancer de plusieurs jours fait trancher la crise par le serveur (« poursuivre ») sans décision du joueur | `decisionsCrise: [{choix:"poursuivre", jour:3}]` après `jours: 8` | le client doit avancer jour par jour |

Défauts mineurs : `etatSimulation` sérialisé en chaîne, `magnetorquers` proposés en orbite lunaire (la Lune n'a pas de champ magnétique global : physiquement inutiles), batteries qui « consomment » 40-60 W.

## 4. Données NASA réelles : où elles sont vraiment utilisées

| Donnée | Stockée ? | Utilisée par la simulation ? | Commentaire |
|---|---|---|---|
| Lune : μ = 4 902,8 km³/s² (NSSDC) | oui | **oui** | correct ; rayon 1 737,1 km contre 1 737,4 km sur la fiche NSSDC : écart signalé par le backend lui-même, non réconcilié |
| Période, ombre, batterie minimale, Tsiolkovski | oui | **oui** | formules exactes (vérifiées : 100 km → 7 065,7 s ; ombre max 0,394) |
| Validation GMAT | fixture GMAT R2026a (script + sortie) | test de physique | crédible ; non rejouable ici sans GMAT |
| Instruments LRO (LROC 19,2 kg / 24 W, LEND 25,8 / 11,6, Diviner 11 / 24,7, Mini-RF 13,8 / 7) | oui, bloc `reference` | **non** | la simulation utilise des valeurs `gameplay` différentes (LEND : 14 kg / 22 W ; Mini-RF : 15 W) marquées `a-calibrer` |
| Composants (structure, énergie, communications…) | — | valeurs inventées | **100 % `a-calibrer`** |
| Lanceurs (elvperf.ksc.nasa.gov) | non relevés | valeurs inventées | `a-calibrer` |
| Orbites | — | valeurs du catalogue | ombre 0,35 alors que le calcul exact donne 0,394 ; l'orbite « elliptique » est en réalité **circulaire à 150 km et 30°** (ne survole pas les pôles), mais elle est créditée de 80 % de couverture |
| Stations sol (White Sands, Matjiesfontein, Alice Springs) | noms et source NTRS | débits inventés | contact sol calculé comme si la station était **sur la Lune** : 4,5 min par orbite au lieu d'environ 6 h/jour pour LRO (Q-01, reconnu par le backend) |
| Archives (Lunar Prospector, LCROSS, LRO) | oui, avec URL NASA | narratif | correct |
| 4 segments (lancement / spatial / sol / utilisateurs) | oui (catégories) | structure | conforme au document NASA |
| Missions réelles comparables (idée du jeu Webb) | oui (`missionsReellesComparables`) | rapport | bonne idée, bien reprise |
| CML, Mission Design Lab, Mission Viz | cités dans `Agent.md` | non | la route `vue` (C10) est l'équivalent Mission Viz, encore inexploité |

**Conclusion §4** : la physique est réelle et juste ; **les composants, lanceurs et débits sont inventés**, et les valeurs réelles LRO, pourtant présentes, ne sont pas branchées.

## 5. Corrections appliquées (15 nov. 2026) — tous les tests du backend passent

| # | Correction | Fichiers |
|---|---|---|
| Racine | `package.json` de monorepo rétabli (scripts `build`, `test`, `boundaries`, `@types/node`, `vitest`) ; fichiers de l'ancien frontend déplacés dans `_ancien-frontend/` | `package.json`, `tsconfig.json`, `README.md` |
| B1 | `GET /api/catalogue/:version` lisible par un joueur (`/versions` reste réservé à l'admin) | `catalogue/src/api/catalogue.controller.ts` |
| B2 | `profilOperations` **calculé par le serveur** au démarrage de la simulation (MTBF tiré de la fiabilité, Δv par Tsiolkovski, durée de vie des panneaux tirée de leur dégradation) ; la valeur envoyée par le client est ignorée | `campagne/src/domain/profil-operations.ts`, `service-campagne.ts` |
| B3 | Plus d'erreur 500 à la clôture : repli sur la dernière fin ; nouvelle règle `missionNonPerdue` | `evaluation/src/domain/evaluation.ts` |
| B4 | Validation de puissance sur la production **moyenne d'orbite** P × (1 − ombre), cohérente avec la simulation | `conception/src/domain/configuration-mission.ts` |
| GDD | Anomalie scénarisée (jour 5, −35 % de production) : elle ouvre toujours la crise de l'Acte V, avec une gravité qui dépend des marges. Champ facultatif `anomalieScenarisee` ajouté au contrat C3 (instantané mis à jour délibérément) | `contracts/src/c3-configuration.ts`, `simulation.ts` |
| B5 | La simulation comptait 40 à 60 W de consommation pour la **batterie** (la validation, elle, l'excluait) : batterie vidée dès le jour 1. Alignée sur la validation | `simulation/src/domain/simulation.ts` |
| Contenu | Scénario aligné sur le GDD : 4 fins (Legacy / Fragment / Last Signal / Silence) exhaustives, rôles des personnages, 4 objectifs | `scenarios/data/lune-polaire/paquet.json` |
| NASA | Instruments à leurs **vraies masses et puissances LRO** ; ombre géométrique exacte ; magnétocoupleurs remplacés par des propulseurs d'attitude ; catalogue en **1.2.0** | `catalogue/data/*.json` |

Tests ajustés, avec la raison de chaque ajustement : T2-01 (l'instrument a désormais une URL source), T2-07 (ombre exacte), fixture de conception (panneau dimensionné pour l'ombre), parcours P7 (crise réelle au lieu d'une batterie à 0).

**Reste à faire** : modèle d'orbite elliptique réel (l'« elliptique » du catalogue est circulaire à 30°), lanceurs non relevés sur elvperf, contact sol A4 (Q-01), aperçu de crise côté serveur (« prévu contre calculé »), endpoint pour les événements `EVT-…` et la posture.

### Lancer
```bash
pnpm install
docker compose up -d
pnpm build && pnpm test
CORS_ORIGINS=http://localhost:5173 JWT_SECRET=<32+ caractères> DATABASE_URL=postgres://smdg:smdg@localhost:5433/smdg pnpm --filter @smdg/server start
```
Import initial, avec un jeton administrateur : `POST /api/catalogue/import` puis `POST /api/scenarios/import`.

## 6. Intégration vérifiée

Partie complète jouée dans Chromium contre ce backend (PostgreSQL 16) : nouvelle mission → profil → atelier → prévalidation → lancement → 5 cycles → crise au jour 5 → décision → résolution → rapport (526/1000, calcul serveur) → écran final. Un seul appel en erreur subsiste (400 sur un passage d'acte, récupéré par le client).
