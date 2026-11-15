import { Module } from "@nestjs/common";
import { SIMULATION_PORT } from "@smdg/contracts";

import { ServiceSimulation } from "./application/service-simulation.js";

@Module({
  providers: [ServiceSimulation, { provide: SIMULATION_PORT, useExisting: ServiceSimulation }],
  exports: [SIMULATION_PORT, ServiceSimulation],
})
export class SimulationModule {}
