import { Inject, Injectable } from "@nestjs/common";
import {
  EVENT_BUS,
  schemaBilanPublie,
  type BilanMission,
  type BusEvenements,
  type EntreeEvaluation,
  type PortEvaluation,
  type RapportMission,
} from "@smdg/contracts";

import { evaluerBilan, exporterRapportJson, genererRapport } from "../domain/evaluation.js";

@Injectable()
export class ServiceEvaluation implements PortEvaluation {
  private readonly bilansPublies = new Map<string, string>();

  constructor(@Inject(EVENT_BUS) private readonly bus: BusEvenements) {}

  evaluer(entree: EntreeEvaluation): BilanMission {
    const bilan = evaluerBilan(entree);
    const serialise = JSON.stringify(bilan);
    const dejaPublie = this.bilansPublies.get(entree.missionId);
    if (dejaPublie !== undefined) {
      if (dejaPublie !== serialise) {
        throw new Error(`BILAN_DEJA_PUBLIE — missionId=${entree.missionId}`);
      }
      return bilan;
    }
    this.bus.publier(
      schemaBilanPublie.parse({
        type: "BilanPublié",
        version: 1,
        missionId: entree.missionId,
        bilan,
      }),
    );
    this.bilansPublies.set(entree.missionId, serialise);
    return bilan;
  }

  genererRapport(entree: EntreeEvaluation, bilan?: BilanMission): RapportMission {
    return genererRapport(entree, bilan);
  }

  exporterRapportJson(rapport: RapportMission): string {
    return exporterRapportJson(rapport);
  }
}
