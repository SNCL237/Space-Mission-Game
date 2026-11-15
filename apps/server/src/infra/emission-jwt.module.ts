import { Module } from "@nestjs/common";
import { EMETTEUR_JWT_PORT } from "@smdg/contracts";

import { EmetteurJwt } from "./emetteur-jwt.js";

@Module({
  providers: [EmetteurJwt, { provide: EMETTEUR_JWT_PORT, useExisting: EmetteurJwt }],
  exports: [EMETTEUR_JWT_PORT],
})
export class EmissionJwtModule {}
