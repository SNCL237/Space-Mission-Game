import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

/** Construction du document OpenAPI (titre, version, schémas des routes). */
export function creerDocumentOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("THE LAST LIGHT — API")
    .setDescription("API du jeu de conception de mission spatiale (backend).")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

/**
 * Montage de la documentation : interface sur `/docs`, document JSON sur
 * `/docs-json` (OpenAPI 3 — contrôle T1-14).
 */
export function monterOpenApi(app: INestApplication): void {
  SwaggerModule.setup("docs", app, creerDocumentOpenApi(app));
}
