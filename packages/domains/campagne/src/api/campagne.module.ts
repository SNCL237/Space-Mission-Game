import { type DynamicModule, Module } from "@nestjs/common";

import { DEPOT_CAMPAGNE } from "../domain/depot.js";
import { DepotCampagneTypeorm } from "../infrastructure/depot-typeorm-campagne.js";
import { ServiceCampagne } from "../application/service-campagne.js";

@Module({})
export class CampagneModule {
  static register(options: { imports?: DynamicModule["imports"] } = {}): DynamicModule {
    return {
      module: CampagneModule,
      imports: options.imports ?? [],
      providers: [
        DepotCampagneTypeorm,
        { provide: DEPOT_CAMPAGNE, useExisting: DepotCampagneTypeorm },
        ServiceCampagne,
      ],
      exports: [ServiceCampagne],
    };
  }
}
