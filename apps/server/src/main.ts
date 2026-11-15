import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { CONFIGURATION_VALIDEE, type ConfigurationServeur } from "./infra/config.zod.js";
import { monterOpenApi } from "./openapi.js";
import { configurerSecuriteHttp } from "./infra/securite-http.js";

async function demarrer(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configuration = app.get<ConfigurationServeur>(CONFIGURATION_VALIDEE);
  configurerSecuriteHttp(app, configuration);
  monterOpenApi(app);

  await app.listen(configuration.PORT);
}

// Un démarrage invalide (variable obligatoire manquante, T1-16) rejette ici :
// on sort proprement en citant la variable, sans trace brute de rejet non traité.
void demarrer().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur));
  process.exit(1);
});
