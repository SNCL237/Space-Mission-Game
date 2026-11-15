import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { VERIFICATEUR_JWT_PORT } from "@smdg/contracts";
import { CatalogueModule } from "@smdg/catalogue";
import { ConceptionModule } from "@smdg/conception";
import { EvaluationModule } from "@smdg/evaluation";
import { ScenariosModule } from "@smdg/scenarios";
import { SimulationModule } from "@smdg/simulation";
import { CampagneModule } from "@smdg/campagne";
import { IdentiteModule } from "@smdg/identite";
import { PedagogieModule } from "@smdg/pedagogie";

import { FiltreExceptions } from "./infra/exception.filter.js";
import { EventBusModule } from "./infra/event-bus.module.js";
import { GardeRole } from "./infra/garde-role.js";
import { ConfigurationModule } from "./infra/configuration.module.js";
import { EmissionJwtModule } from "./infra/emission-jwt.module.js";
import { SanteController } from "./sante.controller.js";
import { PasserelleSimulationGateway } from "./simulation.gateway.js";
import { VerificateurJwt } from "./infra/verificateur-jwt.js";
import { IdentiteController } from "./identite.controller.js";
import { CampagneController } from "./campagne.controller.js";
import { ConceptionController } from "./conception.controller.js";
import { PedagogieController } from "./pedagogie.controller.js";

const moduleConception = ConceptionModule.register({ imports: [CatalogueModule] });
const moduleScenarios = ScenariosModule.register({ imports: [CatalogueModule] });
const moduleCampagne = CampagneModule.register({
  imports: [
    CatalogueModule,
    moduleConception,
    moduleScenarios,
    SimulationModule,
    EvaluationModule,
    EventBusModule,
  ],
});

/**
 * Racine de composition unique (RI5) : configuration validée au démarrage (T1-16),
 * bus d'événements `EVENT_BUS` (T1-17), pipe Zod et filtre d'exceptions globaux,
 * routes de santé, domaines CAT/SCE/CON/SIM/EVA/CAM/PED/IDE et garde de rôles
 * JWT. La configuration validée est fournie par `ConfigurationModule`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    ConfigurationModule,
    EventBusModule,
    EmissionJwtModule,
    CatalogueModule,
    moduleConception,
    moduleScenarios,
    SimulationModule,
    EvaluationModule,
    moduleCampagne,
    IdentiteModule.register({ imports: [EmissionJwtModule] }),
    PedagogieModule,
  ],
  controllers: [
    SanteController,
    IdentiteController,
    CampagneController,
    ConceptionController,
    PedagogieController,
  ],
  providers: [
    VerificateurJwt,
    { provide: VERIFICATEUR_JWT_PORT, useExisting: VerificateurJwt },
    PasserelleSimulationGateway,
    { provide: APP_FILTER, useClass: FiltreExceptions },
    { provide: APP_GUARD, useClass: GardeRole },
  ],
})
export class AppModule {}
