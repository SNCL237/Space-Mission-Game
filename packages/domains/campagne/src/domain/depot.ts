import type {
  EntreeJournal,
  MissionCampagne,
  PageResultat,
  ProgressionScenario,
} from "./types.js";

export const DEPOT_CAMPAGNE = "DEPOT_CAMPAGNE";

export interface DepotCampagne {
  creerMission(mission: MissionCampagne): Promise<void>;
  lireMission(missionId: string): Promise<MissionCampagne | undefined>;
  listerMissions(
    utilisateurId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<MissionCampagne>>;
  enregistrerMission(mission: MissionCampagne): Promise<void>;
  ajouterAuJournal(missionId: string, entree: EntreeJournal): Promise<void>;
  lireJournal(missionId: string): Promise<readonly EntreeJournal[]>;
  lirePageJournal(
    missionId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<EntreeJournal>>;
  lireProgressions(utilisateurId: string): Promise<readonly ProgressionScenario[]>;
  enregistrerProgression(progression: ProgressionScenario): Promise<void>;
}
