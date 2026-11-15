# Agent.md : backend de Space Mission Design Game (THE LAST LIGHT / Orbita)

Ce fichier donne à l’agent IA toutes les contraintes à respecter pour coder le **backend**. Il résume le cahier d’analyse v1.2 et le cahier de conception v1.1.

## 0. Règles d’usage

1. Les sources de vérité, par ordre de priorité : cahier d’analyse v1.2, cahier de conception v1.1, ce fichier. En cas de conflit ou de trou, **ne tranche pas seul** : liste la question dans `docs/QUESTIONS.md` et continue avec l’hypothèse la plus prudente, clairement marquée `// HYPOTHESE`.
2. N’invente aucune donnée réelle (masses, coûts, Isp, performances, missions NASA). Le catalogue est un jeu de **paramètres de gameplay à calibrer** (RG12). Toute valeur sans source est marquée `"source": "a-calibrer"`.
3. Travaille un domaine à la fois. Ne modifie jamais un contrat (`packages/contracts`) sans le signaler et sans mettre à jour ses tests de contrat.
4. Périmètre : **backend uniquement** (domaines, moteurs, API, base de données, tests). Pas de code React, de rendu 3D ni de style.

## 1. Le projet en bref

- Jeu web 3D de conception et de gestion d’une mission spatiale : mission **robotique vers les régions polaires de la Lune**, campagne narrative en **sept actes**, **quatre fins** (A à D), score sur **1000**.
- Réponse au challenge NASA Space Apps « Space Mission Design Game » : chaque décision (masse, puissance, budget, données, communications, temps) a une conséquence visible et expliquée.
- Public : étudiants et enfants, sans connaissances préalables. Les textes sont simples, bilingues (fr, en) et **ne sont jamais écrits dans le backend** (voir section 8).
- Versions : **MVP** solo complet ; **V2** coopération à 4 (domaine `equipe`) ; **V3** classement, partage, bac à sable. Le modèle de données et les contrats doivent déjà prévoir V2.
- La mission est robotique : aucun personnage ne meurt en direct (RG5).
- Environnement de développement : **Windows**. Scripts portables (pas de bash seul), chemins multiplateformes, Docker Desktop pour PostgreSQL.

## 2. Stack imposée

| Couche | Choix |
|---|---|
| Langage | TypeScript en mode `strict` |
| Framework | **NestJS** (Node.js, adaptateur Express par défaut), **un module NestJS par domaine** |
| Configuration | `@nestjs/config`, variables d’environnement validées par Zod |
| Événements | `@nestjs/event-emitter` (bus en mémoire du contrat C9) |
| Documentation API | `@nestjs/swagger` (OpenAPI) |
| Persistance | TypeORM, un schéma par domaine (hypothèse à valider, point ouvert 8) |
| Temps réel | `@nestjs/websockets` + `@nestjs/platform-socket.io` (équipe, progression de la simulation) |
| Base de données | PostgreSQL, **un schéma par domaine** (SQLite en développement) |
| Validation | Zod (schémas des contrats et des requêtes) via un `ZodValidationPipe` maison |
| Monorepo | Workspaces (pnpm recommandé) |
| Tests | Vitest (domaines, contrats, moteurs) avec `@nestjs/testing` et `supertest` ; Playwright réservé au front |
| Qualité | ESLint, Prettier, dependency-cruiser (frontières de domaine) |
| Déploiement | Docker (conteneur Node.js unique) |
| Authentification | `@nestjs/jwt` et guards ; mots de passe hachés (argon2 ou bcrypt) ; mode invité et profil local possibles |

Hors des outils listés ici, ne pas ajouter de framework, d’ORM ni de service externe sans accord. Aucune dépendance externe **pendant le jeu**.

## 3. Architecture : monolithe modulaire par domaines

```
packages/
  kernel/        identifiants, unités, types communs minimaux
  contracts/     contrats C1 à C9 (types TypeScript + schémas Zod)
  physics/       période, éclipse, contact sol, Tsiolkovski (fonctions pures)
  domains/
    identite/  catalogue/  scenarios/  conception/  simulation/
    evaluation/  campagne/  equipe/  pedagogie/  classement/
apps/
  server/        NestJS : AppModule, racine de composition qui assemble les modules de domaine
```

Chaque domaine contient : `domain/` (règles métier pures, **aucun import NestJS**), `application/` (cas d’utilisation, services NestJS minces), `infrastructure/` (dépôts, fichiers), `api/` (contrôleurs, passerelles WebSocket, abonnements aux événements), plus `<domaine>.module.ts`.

### 3.1 Règles d’indépendance (à vérifier en CI)

- **RI1** Un domaine possède ses données : seul lui les écrit.
- **RI2** Références entre domaines par **identifiant et version**, jamais par objet partagé.
- **RI3** Échanges uniquement par **contrats publiés, versionnés, immuables**.
- **RI4** Aucune dépendance cyclique. **`campagne` est le seul orchestrateur** ; les domaines cœur ne se connaissent pas et ne connaissent pas `campagne` (ils reçoivent un identifiant de mission opaque).
- **RI5** Chaque domaine est testable seul, avec des contrats simulés.
- **RI6** Chaque domaine a son vocabulaire (ex. « Configuration » modifiable dans `conception`, copie figée dans `simulation`).
- **RI7** Les domaines ne produisent que des **codes d’explication** ; `pedagogie` les transforme en texte.

Un paquet de domaine importe uniquement `@smdg/kernel`, `@smdg/contracts` et, pour `conception` et `simulation`, `@smdg/physics`. Tout autre import entre domaines **fait échouer la CI**.

| Domaine | Dépendances autorisées |
|---|---|
| identite, catalogue, simulation, evaluation, pedagogie | aucune |
| scenarios | catalogue (validation des identifiants à l’import) |
| conception | catalogue en lecture (C1) ; reçoit le paquet de scénario de `campagne`, n’appelle pas `scenarios` |
| equipe | conception (estimation d’impact, application d’une décision), identite |
| classement | événement BilanPublié (evaluation), identite |
| campagne | scenarios, conception, simulation, evaluation, identite |

### 3.2 Les dix domaines

| Code | Domaine | Responsabilité | Version |
|---|---|---|---|
| IDE | identite | Compte, authentification, langue, profil | MVP |
| CAT | catalogue | Composants, instruments, orbites, lanceurs, stations ; seuils ; versions ; import | MVP |
| SCE | scenarios | Paquets de scénarios : actes, personnages, archives, événements, fins, conditions de déblocage ; import validé ; versions | MVP |
| CON | conception | Objectifs, orbiteur, instruments, lanceur, orbite ; bilans ; compatibilité ; configuration figée | MVP |
| SIM | simulation | Lancement, opérations, énergie, ombre, stockage, transmissions, événements, crise | MVP |
| EVA | evaluation | Score sur 1000, fin A à D, rapport et causes | MVP |
| CAM | campagne | Déroulé des actes, orchestration, journal des décisions, sauvegarde, progression, déblocage | MVP |
| EQU | equipe | Équipes, rôles, propositions, votes | V2 |
| PED | pedagogie | Glossaire, tutoriel, rendu des codes d’explication fr/en | MVP |
| CLA | classement | Classement, partage et comparaison de missions | V3 |

## 3.3 Conventions NestJS

- **Un module NestJS par domaine** (`IdentiteModule`, `CatalogueModule`, etc.), dans `packages/domains/<domaine>/src/<domaine>.module.ts`. Il déclare ses contrôleurs (`api/`), ses services (`application/`) et ses dépôts (`infrastructure/`).
- **`domain/` et moteurs sans NestJS** : aucun import de `@nestjs/*` (ni décorateur) dans `domain/`, dans `simulation` et `evaluation` côté moteur, ni dans `kernel`, `contracts`, `physics`. Ces paquets servent aussi au front (aperçu client) et sont compilés en ESM et CJS. Les services Nest ne sont que de minces adaptateurs qui appellent des fonctions pures.
- **Racine de composition** : `apps/server/src/app.module.ts` est le seul endroit qui connaît tous les modules. **Aucun module de domaine n’importe la classe de module d’un autre domaine.**
- **Ports et jetons d’injection** : chaque domaine expose ses capacités aux autres par une interface et un jeton (`Symbol`) déclarés dans `@smdg/contracts` (ex. `CONCEPTION_PORT`, `SIMULATION_PORT`, `EVALUATION_PORT`, `EVENT_BUS`). Le module du domaine fournit et exporte son implémentation sous ce jeton.
- **Campagne** reçoit ses dépendances par module dynamique : `AppModule` appelle `CampagneModule.register({ imports: [ScenariosModule, ConceptionModule, SimulationModule, EvaluationModule, IdentiteModule] })`. `campagne` injecte uniquement les jetons (`@Inject(CONCEPTION_PORT)`) et n’importe jamais le code des autres domaines.
- **Événements (C9)** : le port `EVENT_BUS` est implémenté dans `apps/server` avec `@nestjs/event-emitter` (abonnements par `@OnEvent`). Les charges utiles sont typées et validées par Zod. Le bus en mémoire doit rester remplaçable.
- **Contrôleurs minces** : ils valident l’entrée (pipe Zod), appellent un cas d’utilisation et renvoient un objet issu des contrats. Aucune règle métier dans un contrôleur.
- **Injection** : `@Inject(JETON)` explicite pour les ports ; dépendances circulaires et `forwardRef` interdits.
- **Passerelles WebSocket** (`equipe`, `simulation`) : classes `@WebSocketGateway` dans `api/`, authentifiées par le même guard JWT.
- **Transverse** (dans `apps/server`, pas dans les domaines) : `ConfigModule`, filtre d’exceptions global (`{ code, params, statut }`), guards JWT et rôles, `ZodValidationPipe`, journalisation, génération OpenAPI.
- **Persistance** : une configuration de connexion par domaine pointant vers son schéma ; **interdit** de déclarer une relation entre entités de domaines différents (`@ManyToOne` et similaires) ; migrations par domaine.

## 4. Contrats entre domaines (`packages/contracts`)

| Contrat | Producteur → consommateurs | Contenu |
|---|---|---|
| C1 RéférentielCatalogue | CAT → CON, SCE | Éléments du catalogue pour une version donnée (lecture seule) |
| C2 PaquetScénario | SCE → CAM, CON, EVA | Cible, budget, objectifs, catalogue autorisé, 7 actes, définitions d’événements, 4 fins et règles, conditions de déblocage, version |
| C3 ConfigurationFigée | CON → CAM, SIM | Copie immuable de l’orbiteur, orbite, lanceur, objectifs, marge, difficulté, bilans |
| C4 RésultatSimulation | SIM → CAM, EVA | Séries temporelles, événements, états des sous-systèmes, décisions de crise, science cumulée, données perdues |
| C5 BilanMission | EVA → CAM, CLA, PED | Fin, score détaillé, causes (codes), décisions clés, recommandations |
| C6 DécisionÉquipe | EQU → CON | Commande « appliquer ce changement » après vote |
| C7 CodeExplication | tous → PED | Code et paramètres |
| C8 IdentitéUtilisateur | IDE → tous | Identifiant et langue (seule donnée partagée) |
| C9 ÉvénementsDomaine | tous → CAM, PED, CLA | MissionCréée, ConceptionValidée, MissionLancée, AnomalieDétectée, CriseDécidée, SimulationTerminée, BilanPublié, ScénarioDébloqué |

```ts
type Id = string; // UUID
interface CodeExplication { code: string; params: Record<string, number | string>; }

interface ConfigurationFigee {              // C3
  configurationId: Id; version: number;
  scenarioId: Id; versionScenario: string; versionCatalogue: string;
  orbiteur: { masseSecheKg: number; carburantKg: number; puissanceProduiteW: number;
    puissanceConsommeeW: number; capaciteBatterieWh: number; coutMUSD: number;
    elements: ElementFige[]; instruments: InstrumentFige[] };
  orbite: { type: OrbiteType; altitudeKm: number; inclinaisonDeg: number; fractionEclipse: number };
  lanceur: { id: Id; capaciteKg: number; fiabilite: number };
  objectifs: { principal: Id; secondaires: Id[] };
  margeDv: number; difficulte: 'decouverte' | 'ingenieur' | 'expert';
}

interface ResultatSimulation {              // C4
  simulationId: Id; graine: number; dureeSimuleeJours: number;
  issue: 'nominale' | 'ecourtee' | 'perdue';
  serie: PointJournalier[];                 // jour, puissanceW, batterieWh, tamponGbit, science
  evenements: EvenementApplique[]; decisionsCrise: DecisionCriseApp[];
  sousSystemes: Record<Id, EtatSousSysteme>;
  scienceCumulee: number; scienceMax: number;
  donneesPerduesGbit: number; carburantRestantKg: number;
}

interface BilanMission {                    // C5
  missionRef: Id; scoreTotal: number;       // sur 1000
  scores: { science: number; technique: number; ressources: number; fiabilite: number; collab: number };
  fin: 'A' | 'B' | 'C' | 'D'; causes: CodeExplication[];
  decisionsCles: Id[]; recommandations: CodeExplication[];
}
```

Tout contrat porte une `version`. Une modification incompatible crée une nouvelle version et conserve l’ancienne lisible (les sauvegardes référencent les versions jouées).

## 5. Règles de gestion à implémenter

| Réf. | Domaine | Règle |
|---|---|---|
| RG1 | CON | La compatibilité masse / orbite / lanceur, le budget et l’énergie minimale sont des règles **dures** : elles bloquent le lancement. Le score ne compense jamais une impossibilité physique. |
| RG2 | CON | Distinguer erreurs bloquantes et avertissements. |
| RG3 | SIM, EVA | Mêmes entrées et mêmes décisions, mêmes résultats. |
| RG4 | EVA | Les fins A à D dépendent des résultats de simulation et des décisions clés, pas d’un choix de dialogue final. |
| RG5 | SCE, SIM | Robotique : sacrifices sur instruments, données, objectifs ou durée de vie, jamais sur des vies. |
| RG6 | SIM, SCE | Un événement critique est annoncé par des indices techniques, des alertes ou des décisions antérieures. |
| RG7 | CON | Un objectif principal et un ou deux secondaires. |
| RG8 | EVA | Score 1000 = science 300 + technique 250 + ressources 200 + fiabilité 150 + collaboration 100 (neutralisée ou redistribuée en solo). |
| RG9 | CAM | Seul le premier scénario est disponible au départ ; un scénario débloqué le reste. |
| RG10 | CAM | Déblocage évalué à la clôture d’une mission, après le rapport. |
| RG11 | CAM | Une sauvegarde conserve l’état, l’historique des décisions et la version du scénario. |
| RG12 | CAT | Valeurs du catalogue : paramètres de gameplay, pas des spécifications réelles. |

Alertes de ressources : **90 % orange**, **100 % rouge**. Compatibilité : alerte de marge faible au-delà de **90 %** de la capacité du lanceur.

## 6. Algorithmes

Les formules sont fixes ; les valeurs numériques viennent du catalogue. Les fonctions des moteurs sont **pures** (pas d’horloge, pas de réseau, pas de base, pas de `Math.random`).

- **A1 Bilans (CON)** : `masseSeche = Σ masses` ; `carburant = masseSeche × (exp(Δv × (1 + margeDv) / (Isp × g0)) − 1)` ; `masseTotale = masseSeche + carburant` ; `puissanceCons = Σ puissance × dutyCycle` ; `puissanceProd = nbPanneaux × puissanceParPanneau × (1 − dégradationAn × duréeAns)` ; `coût = Σ coûts + coût(lanceur) + coûtOpsAn × duréeAns` ; `débitGénéré = Σ débit × tempsObservationParJour`.
- **A2 Compatibilité (CON)** : orbite absente de `lanceur.capaciteKg` → échec `ORBITE_INACCESSIBLE` ; `masseTotale > cap` → échec `MASSE_DEPASSE` avec écart et suggestions (réduire la masse, autre orbite, autre lanceur) ; `> 0.9 × cap` → alerte `MARGE_FAIBLE`.
- **A3 Orbite et éclipse (`physics`)** : `a = R + altitude` ; `T = 2π √(a³/μ)` (μ et R du corps central : la **Lune** pour ce scénario) ; `tEclipse = fractionEclipse × T` ; `capaciteBatterieMin = puissanceCons × tEclipse / (3600 × profondeurDécharge × η)`.
- **A4 Communications (`physics`)** : `ε = 10°` ; `λ = acos(R cos ε / a) − ε` ; `tContactMax = T λ / π` ; `tContactMoyen = 0.6 × tContactMax` ; `volumeDescendant/jour = débitLiaison × tContactMoyen × passagesParJour × (1 − surcoût)` ; si inférieur au volume généré : saturation et données perdues.
- **A5 Fiabilité (SIM)** : `R(t) = Π exp(−t / MTBF_i)` ; `duréeVie = min(duréeCible, dégradationPanneaux, autonomieCarburant, toléranceRadiation)`.
- **A6 Simulation déterministe (SIM)** : générateur `mulberry32(graine)` ; phases : lancement (échec si `rng() > fiabilité`), insertion et pannes initiales, **opérations au pas de 1 jour** (énergie, ombre, stockage, transmissions, événements, indices, crise), fin de vie. Une anomalie énergétique publie `AnomalieDétectée` et attend une décision.
- **A7 Score (EVA)** : science `300 × scienceCumulée / scienceMax` (principal 60 %, secondaires 40 %) ; technique `250 × moyenne(disponibilité des sous-systèmes, marges respectées)` ; ressources `200 × (0.5 × (1 − budgetUtilisé/budgetMax) + 0.5 × (1 − donnéesPerdues/donnéesGénérées))` ; fiabilité `150 × R(duréeVie) × (1 − pénalité(risque accru))` ; collaboration `100 × participation × (1 − conflits)`, en solo redistribuée proportionnellement sur les 4 autres. La **fin** est la première règle satisfaite parmi A, B, C, D selon les règles du paquet de scénario.
- **A8 Vote (EQU)** : quorum `⌈n/2⌉` ; `pour > contre` accepte et envoie C6 ; égalité tranchée par le directeur de mission.
- **A9 Crise (SIM)** : cinq options (désactiver un instrument, réduire les transmissions, suspendre les observations, basse consommation, poursuivre avec risque accru) ; recalcul des ressources et des objectifs ; la décision est consignée.
- **A10 Déblocage (CAM)** : pour chaque scénario verrouillé, toutes les conditions doivent être remplies (prérequis terminé, rang de fin `A < B < C < D`, score minimal).
- **A11 Validation d’import (SCE)** : schéma et version ; exactement 7 actes et 4 fins ; chaque fin atteignable ; identifiants du catalogue autorisé existants dans CAT ; conditions sans cycle ; liste d’erreurs, publication refusée si non vide.

## 7. Ressources NASA du défi : comment les utiliser dans le backend

Ces ressources servent à **cadrer, calibrer et valider**. Aucune n’est appelée pendant le jeu (le catalogue est importé au build, interface I5).

| Ressource | Usage dans le backend | À ne pas faire |
|---|---|---|
| **Design and Develop Science Missions** (4 segments : lancement, spatial, sol, utilisateurs) | Structurer le modèle : segment lancement = `Lanceur` ; segment spatial = orbiteur et instruments ; segment sol = `StationSol` ; segment utilisateurs = résultat scientifique et rapport (EVA). S’en servir pour le vocabulaire des phases et de la vérification (CON `verifier()`). | Ajouter des segments hors de ces quatre sans décision. |
| **GMAT** (outil open source de conception et d’analyse de trajectoires, dont les missions lunaires) | Outil **hors ligne** : produire des valeurs de référence (période, durée d’éclipse, passages) pour comparer `physics` dans des **tests de référence**, et pour contrôler les orbites du catalogue. | L’intégrer au serveur ou l’appeler en jeu. |
| **Concept Maturity Levels (CML 1 à 4)** | Inspirer les niveaux de validation d’une configuration (idée, faisabilité, compromis, conception ponctuelle) et le lien avec la difficulté. Optionnel, à valider avant d’ajouter des états. | Modifier les statuts de `ConfigurationMission` sans accord. |
| **Mission Design Lab (MDL)** : niveaux d’étude et disciplines (puissance, propulsion, thermique, structures, avionique, communications, contrôle d’attitude, logiciel, fiabilité, coût, risque) | S’aligner sur ces disciplines pour les catégories de composants et de bilans. **Attention** : la **thermique** n’apparaît pas dans l’analyse v1.2. Soulever la question (QUESTIONS.md) avant de l’ajouter. | Ajouter une catégorie ou un bilan thermique de sa propre initiative. |
| **NASA Mission Viz** (visualisation 3D de missions et trajectoires) | Le backend expose une **vue de mission** pour le front 3D : paramètres orbitaux, positions échantillonnées de la trajectoire, chronologie des événements. | Écrire du code de rendu. |
| **A Learning Game About Telescopes** | Reprendre trois idées : (1) des options **indisponibles** quand elles sont incompatibles avec les objectifs choisis (CON renvoie `disponible: false` avec un code de raison) ; (2) **trois niveaux de difficulté** (`decouverte`, `ingenieur`, `expert`) où les niveaux élevés autorisent plusieurs objectifs ; (3) un rapport qui peut **rapprocher la conception de missions réelles** via un champ optionnel `missionsReelles` du catalogue. | Inventer des missions équivalentes : ce champ est rempli seulement depuis des données sourcées. |
| **Cubesat 101** (de la conception des opérations au lancement et à l’exploitation) | Référence pour l’enchaînement des phases (concept d’opérations, lancement, exploitation) et pour un futur catalogue « simple » (niveau Découverte). | Créer un scénario CubeSat dans le MVP. |
| **Défi Space Apps 2023 : visualiser une mission en réalité virtuelle** (concept, trajectoires, chronologie, visualisation 3D) | Confirme les quatre éléments de la vue de mission : concept (objectifs), trajectoire, chronologie, données 3D. | Ajouter de la réalité virtuelle côté backend. |
| **Ressources CSA (jeux et activités numériques)** | Inspiration pour les contenus pédagogiques (`pedagogie`) : explications courtes, accessibles à tous les âges. | Copier leurs contenus. |

Toute valeur du catalogue issue d’une source publique NASA ou ESA porte `source` et `urlSource`. Les ordres de grandeur restent cohérents avec le réel, sans prétendre à la précision.

## 8. Pédagogie et textes

- Les domaines n’écrivent **aucun texte destiné au joueur**. Ils renvoient des `CodeExplication { code, params }` ; `pedagogie` produit le texte en **français et en anglais**.
- Chaque erreur, alerte, cause et recommandation a un code stable (`MASSE_DEPASSE`, `MARGE_FAIBLE`, `ORBITE_INACCESSIBLE`, etc.) et des paramètres chiffrés (écart en kg, pourcentage).
- Les textes de narration (briefing, dialogues, archives, fins) vivent **dans les paquets de scénario** (domaine `scenarios`), pas dans le code.
- Aucune explication de type « bon » ou « mauvais » seul : toujours le **pourquoi** et une piste.

## 9. Données et catalogue

- Catalogue et scénarios : **fichiers JSON versionnés**, validés par Zod, chargés en base. Ajouter un scénario ne demande **aucune modification de code** (import validé par A11).
- Unités dans les noms : `massKg`, `powerW`, `dataMbps`, `energyWh`, `costMUSD`, `altitudeKm`.
- Les valeurs de l’exemple d’analyse (orbiteur de 310 kg, lanceur de 420 kg, budget de 100 M$, etc.) sont **illustratives**.
- Éléments du catalogue : structure, énergie (panneaux, batteries), communications, ordinateur de bord, contrôle d’attitude, propulsion, instruments (caméra haute résolution, spectromètre neutronique, imageur thermique, radar), lanceurs (léger, moyen, lourd), orbites (polaire, circulaire basse, elliptique), stations sol.

## 10. Base de données

- Un schéma par domaine : `ide`, `cat`, `sce`, `con`, `sim`, `eva`, `cam`, `equ`, `ped`, `cla`.
- **Aucune clé étrangère ni jointure entre schémas** : références par identifiant UUID et version.
- Migrations versionnées par domaine ; un domaine ne touche jamais aux migrations d’un autre.
- Une sauvegarde (`cam`) stocke l’état, l’historique des décisions, la version du scénario, la version du catalogue et la graine.

## 11. API

- REST JSON sous `/api/<domaine>/...` (préfixe porté par le contrôleur de chaque domaine) ; passerelles WebSocket pour l’équipe et la progression de la simulation ; documentation OpenAPI générée par `@nestjs/swagger`.
- Validation Zod de toutes les entrées ; réponses d’erreur homogènes : `{ code, params, statut }`.
- Les routes de lecture de `conception` renvoient bilans, alertes et `disponible` par option ; la route de lancement n’est acceptée que si la configuration est valide (RG1).
- Le score **officiel** est toujours recalculé côté serveur avec le même moteur que l’aperçu client (`simulation` et `evaluation` sont des paquets purs partagés).
- Les routes d’administration (catalogue, scénarios) exigent le rôle administrateur.

## 12. Sécurité et données personnelles

- Minimisation : pseudo, e-mail (optionnel), langue. Mode invité et profil local sans e-mail.
- Mots de passe hachés ; secrets uniquement par variables d’environnement ; jamais de secret dans le dépôt.
- `helmet`, CORS restreint aux origines du front, limitation de débit sur les routes d’authentification.
- Public jeune : aucune collecte superflue, aucun contenu inapproprié dans les paquets de scénario.
- Anti-triche : tout score classé et toute progression sont validés côté serveur.
- Journaux sans donnée personnelle inutile.

## 13. Performance et connectivité

- Connexions limitées : réponses légères, pagination, pas d’appel externe en jeu.
- La simulation d’une mission complète s’exécute **sans interface** et rapidement (cible à définir avec l’équipe, voir section 17).

## 14. Tests et qualité

- **Moteurs** (`physics`, `simulation`, `evaluation`) : tests unitaires systématiques, tests de **déterminisme** (même graine, même résultat), tests de référence contre des valeurs externes (ex. GMAT).
- **Tests de contrat** : le producteur respecte le schéma ; chaque consommateur sait le lire.
- **Tests NestJS** : `@nestjs/testing` avec fournisseurs simulés sous les jetons de ports pour tester un module de domaine seul ; tests e2e de l’`AppModule` (`supertest`) pour les parcours. Avec Vitest, ajouter le plugin SWC (`unplugin-swc`) pour les métadonnées de décorateurs (point ouvert 9).
- **Tests par domaine** avec contrats simulés (RI5).
- **Vérification des frontières** : `dependency-cruiser` en CI.
- Une fonctionnalité n’est terminée que si : types stricts sans `any`, lint propre, tests verts, contrats à jour, aucune frontière violée.

## 15. Standards de code et Git

- TypeScript `strict`, ESLint, Prettier. camelCase (variables), PascalCase (types).
- Moteurs en fonctions pures ; aléatoire uniquement via `mulberry32` à graine.
- Commits conventionnels, une branche par fonctionnalité, revue avant fusion.
- Documenter chaque domaine par un `README.md` court : responsabilité, contrats consommés et produits, commandes de test.

## 16. Ordre d’implémentation

| Étape | Contenu | Terminé quand |
|---|---|---|
| 1 | `kernel`, `contracts` (dont jetons de ports), `physics`, squelette `apps/server` | Contrats C1 à C9 gelés avec tests ; formules A3 et A4 testées ; `AppModule` démarre avec pipe Zod, filtre d’exceptions, configuration et OpenAPI |
| 2 | `catalogue` et `scenarios` (parallèle) | JSON du catalogue et du scénario lunaire importés ; A11 passe |
| 3 | `conception` | Bilans A1, compatibilité A2, `figer()` produisant C3 |
| 4 | `simulation` et `evaluation` (parallèle) | Mission complète simulable sans interface ; score A7 ; crise A9 ; déterminisme prouvé |
| 5 | `campagne`, `pedagogie`, `identite` | Parcours complet des 7 actes ; sauvegarde et reprise ; déblocage A10 ; codes rendus en fr et en |
| 6 | API et vue de mission pour le front 3D | Endpoints documentés ; aperçu client et serveur identiques |
| 7 | V2 `equipe` | Rôles, propositions, votes (A8) |
| 8 | V3 `classement` | Classement et partage |

Les étapes 2 à 4 peuvent se mener en parallèle une fois les contrats gelés.

## 17. Points ouverts : l’agent ne tranche pas seul

1. Seuils exacts des **fins A à D** (à reprendre du GDD). En attendant, règles de scénario configurables avec valeurs d’exemple.
2. Conservation de la progression : **compte ou profil local**.
3. **Noyau physique partagé** par `conception` et `simulation` (`@smdg/physics`) : à confirmer.
4. Ajout éventuel de la **thermique** (disciplines MDL) au modèle.
5. Tolérance des tests de référence contre GMAT et objectif de temps d’exécution d’une simulation complète.
6. Règle de compatibilité des sauvegardes lorsque la version d’un scénario change.
7. Récompenses de déblocage (nouveaux instruments ou lanceurs).
8. Couche de persistance avec NestJS : TypeORM proposé (schéma par entité) ; alternatives Prisma, Drizzle, Kysely. À valider avant l’étape 2.
9. Lanceur de tests : Vitest avec `unplugin-swc` proposé ; Jest reste le choix par défaut de NestJS.

## 18. Interdits

- Importer un domaine depuis un autre domaine (hors `campagne` via les contrats).
- Importer la classe de module d’un autre domaine ailleurs que dans `apps/server`.
- Importer `@nestjs/*` dans `domain/`, dans un moteur ou dans `kernel`, `contracts`, `physics`.
- Utiliser `forwardRef` ou créer une dépendance circulaire entre modules.
- Lire ou écrire le schéma d’un autre domaine.
- Écrire du texte joueur dans le code d’un domaine.
- Utiliser `Math.random`, l’heure système ou le réseau dans un moteur.
- Appeler un service externe pendant le jeu.
- Inventer des données réelles ou des missions NASA.
- Modifier un contrat sans version, sans test de contrat et sans le signaler.
- Écrire du code front, de rendu 3D ou de style.
