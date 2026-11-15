// Domaine catalogue (CAT) — schéma JSON F2.1, import validé F2.2, lecture C1
// F2.3, catalogue lunaire F2.4/F2.5, routes d'administration F2.10 (P2).

export {
  DOMAINES_ACCEPTES_DEFAUT,
  SOURCE_A_CALIBRER,
  estSourceReelle,
  problemeSource,
  type ReglesSource,
} from "./domain/sources.js";
export {
  SEGMENTS_CATALOGUE,
  construireSchemaCatalogue,
  schemaCatalogue,
  type DocumentCatalogue,
  type OptionsSchemaCatalogue,
  type SegmentCatalogue,
} from "./domain/schema-catalogue.js";
export { projeterVersC1, projeterVersC1Valide } from "./domain/projection.js";
export { DEPOT_CATALOGUE, type DepotCatalogue } from "./domain/depot.js";
export {
  ImporterCatalogue,
  versErreursCatalogue,
  type RapportImportCatalogue,
} from "./application/importer-catalogue.js";
export {
  chargerCatalogueDepuisDisque,
  resoudreDossierCatalogue,
  resoudreRacineWorkspace,
} from "./infrastructure/source-donnees.js";
export { DepotCatalogueTypeorm } from "./infrastructure/depot-typeorm-catalogue.js";
export { URL_POSTGRES_DEFAUT, creerDataSourceCatalogue } from "./infrastructure/source-typeorm.js";
export { CatalogueModule } from "./api/catalogue.module.js";
