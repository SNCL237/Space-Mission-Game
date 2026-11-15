import { type DynamicModule, Module } from "@nestjs/common";
import { CONCEPTION_PORT } from "@smdg/contracts";

import { ServiceConception } from "../application/service-conception.js";

/** Module dynamique : le serveur fournit le module qui exporte CATALOGUE_PORT. */
@Module({})
export class ConceptionModule {
  static register(options: { imports?: DynamicModule["imports"] } = {}): DynamicModule {
    return {
      module: ConceptionModule,
      imports: options.imports ?? [],
      providers: [ServiceConception, { provide: CONCEPTION_PORT, useExisting: ServiceConception }],
      exports: [CONCEPTION_PORT, ServiceConception],
    };
  }
}
