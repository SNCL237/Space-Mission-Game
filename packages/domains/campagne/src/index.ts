export { CampagneModule } from "./api/campagne.module.js";
export { ServiceCampagne } from "./application/service-campagne.js";
export { DEPOT_CAMPAGNE, type DepotCampagne } from "./domain/depot.js";
export { ErreurCampagne } from "./domain/erreur-campagne.js";
export { DepotCampagneTypeorm } from "./infrastructure/depot-typeorm-campagne.js";
export { creerDataSourceCampagne } from "./infrastructure/source-typeorm.js";
export type {
  ActeCampagne,
  EntreeCreationMission,
  EntreeJournal,
  MissionCampagne,
  PageResultat,
  ProgressionScenario,
  ResultatDeblocage,
  ScenarioDisponible,
} from "./domain/types.js";
