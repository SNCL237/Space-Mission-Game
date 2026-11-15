import { Inject, Injectable } from "@nestjs/common";
import {
  EVENT_BUS,
  schemaProgressionSimulation,
  schemaSimulationTerminee,
  type BusEvenements,
  type ChoixCrise,
  type CommandeSimulation,
  type EvenementDomaine,
  type OptionsDemarrageSimulation,
  type PortSimulation,
  type ProgressionSimulation,
  type ResultatSimulation,
} from "@smdg/contracts";

import {
  avancer,
  decider,
  demarrer,
  obtenirProgression,
  rehydraterEtatSimulation,
  serialiserEtatSimulation,
  terminer,
} from "../domain/simulation.js";

@Injectable()
export class ServiceSimulation implements PortSimulation {
  constructor(@Inject(EVENT_BUS) private readonly bus: BusEvenements) {}

  demarrer(options: OptionsDemarrageSimulation): string {
    const transition = demarrer(options);
    this.publier(transition.evenements);
    return serialiserEtatSimulation(transition.etat);
  }

  avancer(etatSerialise: string, commandes: readonly CommandeSimulation[], jours: number): string {
    const transition = avancer(rehydraterEtatSimulation(etatSerialise), commandes, jours);
    this.publier(transition.evenements);
    return serialiserEtatSimulation(transition.etat);
  }

  decider(etatSerialise: string, choix: ChoixCrise, cibleId?: string): string {
    const transition = decider(rehydraterEtatSimulation(etatSerialise), choix, cibleId);
    this.publier(transition.evenements);
    return serialiserEtatSimulation(transition.etat);
  }

  terminer(etatSerialise: string): ResultatSimulation {
    const etat = rehydraterEtatSimulation(etatSerialise);
    const resultat = terminer(etat);
    if (!etat.terminee) {
      this.bus.publier(
        schemaSimulationTerminee.parse({
          type: "SimulationTerminée",
          version: 1,
          missionId: etat.missionId,
          simulationId: resultat.simulationId,
          issue: resultat.issue,
        }),
      );
    }
    return resultat;
  }

  progression(etatSerialise: string): ProgressionSimulation {
    return schemaProgressionSimulation.parse(
      obtenirProgression(rehydraterEtatSimulation(etatSerialise)),
    );
  }

  private publier(evenements: readonly EvenementDomaine[]): void {
    for (const evenement of evenements) this.bus.publier(evenement);
  }
}
