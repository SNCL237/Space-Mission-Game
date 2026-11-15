import { Module } from "@nestjs/common";
import { EVALUATION_PORT } from "@smdg/contracts";

import { ServiceEvaluation } from "./application/service-evaluation.js";

@Module({
  providers: [ServiceEvaluation, { provide: EVALUATION_PORT, useExisting: ServiceEvaluation }],
  exports: [EVALUATION_PORT, ServiceEvaluation],
})
export class EvaluationModule {}
