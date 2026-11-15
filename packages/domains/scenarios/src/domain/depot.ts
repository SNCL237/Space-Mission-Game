import type { PaquetScenarioSc } from "./schema-paquet.js";

// Port d'écriture/lecture du dépôt scénarios (couche domaine, pur — aucune
// dépendance TypeORM ici ; l'implémentation vit dans infrastructure/).

/** Jeton d'injection du dépôt (paramètre explicite, PT2 : sans metadata). */
export const DEPOT_SCENARIOS = "DEPOT_SCENARIOS";

/** Situation d'un scénario connu : ses arêtes de déblocage (A10/A11). */
export interface SituationScenario {
  readonly id: string;
  readonly prerequis: string[];
}

export interface DepotScenarios {
  /**
   * Import idempotent : clé primaire `(scenario_id, version)` — ré-importer
   * remplace sans doublon.
   */
  enregistrer(paquet: PaquetScenarioSc): Promise<void>;
  /** Identifiants des scénarios en base (contrôle A11). */
  listerIds(): Promise<string[]>;
  /** Arêtes `prerequis` de tous les scénarios en base (détection de cycle A11). */
  listerSituations(): Promise<SituationScenario[]>;
  /** Paquet complet re-validé (`schemaPaquetScenarioSc`). */
  lire(scenarioId: string, version: string): Promise<PaquetScenarioSc | undefined>;
}
