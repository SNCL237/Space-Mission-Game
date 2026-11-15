import type {
  ConfigurationFigee,
  CommandeSimulation,
  DecisionCriseApp,
  DefinitionEvenement,
  EtatSousSysteme,
  EvenementDomaine,
  EvenementApplique,
  IssueSimulation,
  PointJournalier,
  ResultatSimulation,
} from "@smdg/contracts";

export interface EtatSimulation {
  readonly version: 1;
  readonly missionId: string;
  readonly simulationId: string;
  readonly configuration: ConfigurationFigee;
  readonly definitionsEvenements: readonly DefinitionEvenement[];
  readonly graine: number;
  readonly etatRng: number;
  readonly tiragesRng: number;
  readonly jour: number;
  readonly limiteJours: number;
  readonly issue: IssueSimulation;
  readonly terminee: boolean;
  readonly batterieWh: number;
  readonly tamponGbit: number;
  readonly donneesGenereesGbit: number;
  readonly donneesTransmisesGbit: number;
  readonly donneesPerduesGbit: number;
  readonly scienceCumulee: number;
  readonly scienceMax: number;
  readonly scienceParObjectif: Readonly<Record<string, number>>;
  readonly scienceMaxParObjectif: Readonly<Record<string, number>>;
  readonly carburantRestantKg: number;
  readonly deltaVRestantMs: number;
  readonly instrumentsActifs: readonly string[];
  readonly observationsPlanifiees: readonly string[];
  readonly transmissionActive: boolean;
  readonly facteurTransmission: number;
  readonly modeBasseConsommation: boolean;
  readonly observationsSuspenduesJusqua: number;
  readonly risqueAccru: boolean;
  readonly objectifsSacrifies: readonly string[];
  readonly sousSystemes: Readonly<Record<string, EtatSousSysteme>>;
  readonly serie: readonly PointJournalier[];
  readonly evenements: readonly EvenementApplique[];
  readonly decisionsCrise: readonly DecisionCriseApp[];
  readonly commandesPlanifiees: readonly CommandeSimulation[];
  readonly evenementsPlanifies: readonly {
    readonly definitionId: string;
    readonly jour: number;
  }[];
  readonly criseEnAttente: { readonly jour: number; readonly echeance: number } | null;
  readonly anomalieEnergetiqueEmise: boolean;
}

export interface TransitionSimulation {
  readonly etat: EtatSimulation;
  readonly evenements: readonly EvenementDomaine[];
}

export type ResultatFinal = ResultatSimulation;
