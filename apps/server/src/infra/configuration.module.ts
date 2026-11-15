import { Global, Module } from "@nestjs/common";

import { CONFIGURATION_VALIDEE, validerConfiguration } from "./config.zod.js";

@Global()
@Module({
  providers: [
    { provide: CONFIGURATION_VALIDEE, useFactory: () => validerConfiguration(process.env) },
  ],
  exports: [CONFIGURATION_VALIDEE],
})
export class ConfigurationModule {}
