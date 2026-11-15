import type { DocumentCatalogue } from "./schema-catalogue.js";

// Port d'écriture/lecture du dépôt catalogue (couche domaine, pur — aucune
// dépendance TypeORM ici ; l'implémentation vit dans infrastructure/).

/** Jeton d'injection du dépôt (paramètre explicite, PT2 : sans metadata). */
export const DEPOT_CATALOGUE = "DEPOT_CATALOGUE";

export interface DepotCatalogue {
  /**
   * Import idempotent : la clé primaire est `version` — ré-importer une
   * version déjà présente remplace le document sans doublon (T2-04).
   */
  enregistrer(document: DocumentCatalogue): Promise<void>;
  /** Versions importées, triées. */
  listerVersions(): Promise<string[]>;
  /** Document domaine d'une version (re-validé par `schemaCatalogue`). */
  lireDocument(version: string): Promise<DocumentCatalogue | undefined>;
  /** Identifiants UUID des documents importés (contrôle A11 côté SCE). */
  listerIdentifiants(): Promise<string[]>;
}
