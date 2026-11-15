// Domaine scénarios (SCE) — paquet C2 enrichi, validation A11 (F2.9), import
// depuis `data/` sans changement de code (F2.10, T2-15), routes d'admin (P2).

export {
  schemaArchive,
  schemaDefinitionEvenementSc,
  schemaEvenementNarratif,
  schemaPaquetScenarioSc,
  schemaPersonnage,
  type Archive,
  type EvenementNarratif,
  type PaquetScenarioSc,
  type Personnage,
} from "./domain/schema-paquet.js";
export { DEPOT_SCENARIOS, type DepotScenarios, type SituationScenario } from "./domain/depot.js";
export {
  CODES_A11,
  trouverCycle,
  validerPaquetA11,
  type ContexteA11,
} from "./domain/validation-a11.js";
export { ImporterPaquets, type RapportImportScenarios } from "./application/importer-paquets.js";
export { ValiderPaquet, type RapportValidation } from "./application/valider-paquet.js";
export {
  chargerPaquetsDepuisDisque,
  resoudreDossierScenarios,
  resoudreRacineWorkspace,
} from "./infrastructure/source-donnees.js";
export { DepotScenariosTypeorm } from "./infrastructure/depot-typeorm-paquets.js";
export { URL_POSTGRES_DEFAUT, creerDataSourceScenarios } from "./infrastructure/source-typeorm.js";
export { ScenariosModule } from "./api/scenarios.module.js";
