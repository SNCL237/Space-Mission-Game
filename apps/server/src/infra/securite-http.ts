import type { INestApplication } from "@nestjs/common";
import helmet from "helmet";

import type { ConfigurationServeur } from "./config.zod.js";

export function configurerSecuriteHttp(
  app: INestApplication,
  configuration: ConfigurationServeur,
): void {
  app.use(helmet());
  const origines = configuration.CORS_ORIGINS.split(",")
    .map((origine) => origine.trim())
    .filter((origine) => origine.length > 0);
  app.enableCors({ origin: origines, credentials: true });
}
