import type {
  BilanMission,
  CodeExplication,
  ConfigurationFigee,
  PaquetScenario,
  ResultatSimulation,
} from "@smdg/contracts";

export type ActeCampagne = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EntreeJournal {
  readonly id: string;
  readonly acte: ActeCampagne;
  readonly libelle: string;
  readonly effets: readonly CodeExplication[];
  readonly date: string;
}

export interface ProgressionScenario {
  readonly utilisateurId: string;
  readonly scenarioId: string;
  readonly disponible: boolean;
  readonly termine: boolean;
  readonly tentatives: number;
  readonly meilleurScore: number | null;
  readonly meilleureFin: "A" | "B" | "C" | "D" | null;
}

export interface MissionCampagne {
  readonly id: string;
  readonly utilisateurId: string;
  readonly scenarioId: string;
  readonly versionScenario: string;
  readonly versionCatalogue: string;
  readonly graine: number;
  readonly acte: ActeCampagne;
  readonly configurationId: string;
  readonly scenario: PaquetScenario;
  readonly configuration: ConfigurationFigee | null;
  readonly etatSimulation: string | null;
  readonly resultat: ResultatSimulation | null;
  readonly bilan: BilanMission | null;
  readonly rapportJson: string | null;
  readonly terminee: boolean;
}

export interface SituationScenarioCampagne {
  readonly scenario: PaquetScenario;
  readonly ordre: number;
  readonly version: string;
}

export interface ScenarioDisponible {
  readonly scenarioId: string;
  readonly version: string;
  readonly ordre: number;
  readonly statut: "disponible" | "verrouille" | "termine";
  readonly conditionsRestantes: readonly CodeExplication[];
  readonly progression: ProgressionScenario;
}

export interface EntreeCreationMission {
  readonly missionId: string;
  readonly utilisateurId: string;
  readonly scenarioId: string;
  readonly versionScenario: string;
  readonly versionCatalogue: string;
  readonly configurationId: string;
  readonly graine: number;
}

export interface ResultatDeblocage {
  readonly progression: readonly ProgressionScenario[];
  readonly debloques: readonly string[];
}

export interface PageResultat<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
