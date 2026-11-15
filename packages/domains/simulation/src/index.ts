export {
  calculerDureeEclipseS,
  calculerFiabilite,
  capaciteDescenteGbitJour,
  avancer,
  decider,
  demarrer,
  obtenirProgression,
  rehydraterEtatSimulation,
  serialiserEtatSimulation,
  terminer,
} from "./domain/simulation.js";
export { ErreurSimulation } from "./domain/erreur-simulation.js";
export type { EtatSimulation, TransitionSimulation } from "./domain/types.js";
export type { ProgressionSimulation } from "@smdg/contracts";
export { ServiceSimulation } from "./application/service-simulation.js";
export { SimulationModule } from "./simulation.module.js";
