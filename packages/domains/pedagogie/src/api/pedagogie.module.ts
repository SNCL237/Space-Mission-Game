import { Module } from "@nestjs/common";
import { PEDAGOGIE_PORT } from "@smdg/contracts";

import { ServicePedagogie } from "../application/service-pedagogie.js";

@Module({
  providers: [ServicePedagogie, { provide: PEDAGOGIE_PORT, useExisting: ServicePedagogie }],
  exports: [PEDAGOGIE_PORT, ServicePedagogie],
})
export class PedagogieModule {}
