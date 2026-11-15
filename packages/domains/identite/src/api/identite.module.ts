import { type DynamicModule, Module } from "@nestjs/common";
import { IDENTITE_PORT } from "@smdg/contracts";

import { ServiceIdentite } from "../application/service-identite.js";
import { DEPOT_IDENTITE } from "../domain/depot.js";
import { DepotIdentiteTypeorm } from "../infrastructure/depot-typeorm-identite.js";

@Module({})
export class IdentiteModule {
  static register(options: { imports?: DynamicModule["imports"] } = {}): DynamicModule {
    return {
      module: IdentiteModule,
      imports: options.imports ?? [],
      providers: [
        DepotIdentiteTypeorm,
        { provide: DEPOT_IDENTITE, useExisting: DepotIdentiteTypeorm },
        ServiceIdentite,
        { provide: IDENTITE_PORT, useExisting: ServiceIdentite },
      ],
      exports: [IDENTITE_PORT, ServiceIdentite],
    };
  }
}
