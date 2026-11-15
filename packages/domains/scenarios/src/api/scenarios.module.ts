import { type DynamicModule, Module } from "@nestjs/common";
import { SCENARIOS_PORT } from "@smdg/contracts";

import { ImporterPaquets } from "../application/importer-paquets.js";
import { ValiderPaquet } from "../application/valider-paquet.js";
import { DEPOT_SCENARIOS } from "../domain/depot.js";
import { DepotScenariosTypeorm } from "../infrastructure/depot-typeorm-paquets.js";
import { ScenarioController } from "./scenario.controller.js";

/**
 * Module du domaine scénarios (F2.9/F2.10) — **dynamique** : le module
 * consommateur (racine de composition, RI5) fournit les imports qui servent à
 * satisfaire le jeton `CATALOGUE_PORT` (contrat C2/A11). Aucun domaine n'en
 * importe un autre (RI1) : ici on ne référence que le jeton de contracts.
 */
@Module({})
export class ScenariosModule {
  static register(options: { imports?: DynamicModule["imports"] } = {}): DynamicModule {
    return {
      module: ScenariosModule,
      imports: options.imports ?? [],
      controllers: [ScenarioController],
      providers: [
        DepotScenariosTypeorm,
        ValiderPaquet,
        ImporterPaquets,
        { provide: DEPOT_SCENARIOS, useExisting: DepotScenariosTypeorm },
        { provide: SCENARIOS_PORT, useExisting: DepotScenariosTypeorm },
      ],
      exports: [ValiderPaquet, ImporterPaquets, SCENARIOS_PORT],
    };
  }
}
