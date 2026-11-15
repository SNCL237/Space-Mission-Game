import type {
  CodeExplication,
  ComposantCatalogue,
  ConfigurationFigee,
  Difficulte,
  InstrumentCatalogue,
  ProfilOperations,
  ReferentielCatalogue,
} from "@smdg/contracts";

export interface ParametresMission {
  readonly configurationId: string;
  readonly scenarioId: string;
  readonly versionScenario: string;
  readonly budgetMaxMUSD: number;
  readonly deltaVms: number;
  readonly margeDv: number;
  readonly dureeMissionAns: number;
  readonly coutOperationsAnnuelMUSD: number;
  readonly profondeurDecharge: number;
  readonly rendement: number;
  readonly tempsObservationSParJour: number;
  readonly difficulte: Difficulte;
  readonly profilOperations?: ProfilOperations;
}

export interface OptionsConfigurationMission extends ParametresMission {
  readonly catalogue: ReferentielCatalogue;
}

export interface BilanConception {
  readonly masseSecheKg: number;
  readonly carburantKg: number;
  readonly masseTotaleKg: number;
  readonly puissanceProduiteW: number;
  readonly puissanceConsommeeW: number;
  readonly capaciteBatterieWh: number;
  readonly capaciteBatterieMinWh: number;
  readonly coutMUSD: number;
  readonly debitGenereGbitJour: number;
}

export interface RapportVerification {
  readonly valide: boolean;
  readonly erreurs: readonly CodeExplication[];
  readonly avertissements: readonly CodeExplication[];
  readonly suggestions: readonly CodeExplication[];
  readonly bilans?: BilanConception;
}

export interface OptionDisponible {
  readonly id: string;
  readonly type: "composant" | "instrument";
  readonly disponible: boolean;
  readonly raison?: string;
}

export interface DeltaConception {
  readonly margeDv?: number;
  readonly ajouterElements?: readonly string[];
  readonly retirerElements?: readonly string[];
  readonly ajouterInstruments?: readonly string[];
  readonly retirerInstruments?: readonly string[];
  readonly lanceurId?: string;
  readonly orbiteId?: string;
}

export interface EcartVariantes {
  readonly masseTotaleKg: number;
  readonly carburantKg: number;
  readonly puissanceConsommeeW: number;
  readonly coutMUSD: number;
}

export interface SelectionElement {
  readonly catalogue: ComposantCatalogue;
}

export interface SelectionInstrument {
  readonly catalogue: InstrumentCatalogue;
  objectifs: string[];
}

export interface InstantaneFige {
  readonly configuration: ConfigurationFigee;
}
