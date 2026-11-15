import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { creerDocumentOpenApi } from "../src/openapi.js";

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

describe("P7 — couverture OpenAPI", () => {
  it("documente chaque route avec une opération et des réponses", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app: INestApplication = moduleRef.createNestApplication({ logger: false });
    try {
      await app.init();
      const document = creerDocumentOpenApi(app);
      const operations = Object.values(document.paths).flatMap((path) =>
        Object.values(path ?? {}).filter(
          (operation): operation is NonNullable<typeof operation> => operation !== undefined,
        ),
      );

      expect(Object.keys(document.paths).sort()).toEqual(
        [
          "/api/campagne/missions",
          "/api/campagne/missions/{missionId}",
          "/api/campagne/missions/{missionId}/actes",
          "/api/campagne/missions/{missionId}/crise",
          "/api/campagne/missions/{missionId}/cloturer",
          "/api/campagne/missions/{missionId}/journal",
          "/api/campagne/missions/{missionId}/reprise",
          "/api/campagne/missions/{missionId}/simulation",
          "/api/campagne/missions/{missionId}/vue",
          "/api/campagne/scenarios",
          "/api/catalogue/{version}",
          "/api/catalogue/import",
          "/api/catalogue/versions",
          "/api/conception/configurations",
          "/api/conception/configurations/{configurationId}",
          "/api/conception/configurations/{configurationId}/figer",
          "/api/health",
          "/api/health/echo",
          "/api/identite/connexion",
          "/api/identite/inscription",
          "/api/identite/invites",
          "/api/identite/profil",
          "/api/identite/profil/langue",
          "/api/pedagogie/codes/{code}",
          "/api/pedagogie/glossaire",
          "/api/scenarios/import",
          "/api/scenarios/valider",
        ].sort(),
      );
      expect(operations).toHaveLength(29);
      for (const operation of operations) {
        expect(operation.summary).toBeTruthy();
        expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
      }

      expect(document.paths["/api/campagne/missions/{missionId}/vue"]?.get?.summary).toBeTruthy();
      expect(
        document.paths["/api/conception/configurations"]?.post?.summary,
      ).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});
