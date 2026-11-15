import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { creerDataSourceIdentite } from "@smdg/identite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { configurerSecuriteHttp } from "../src/infra/securite-http.js";
import { validerConfiguration } from "../src/infra/config.zod.js";

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  configurerSecuriteHttp(app, validerConfiguration(process.env));
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("P7 — sécurité HTTP", () => {
  it("applique Helmet et n'autorise que les origines configurées", async () => {
    const autorisee = await request(app.getHttpServer())
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(autorisee.headers["x-content-type-options"]).toBe("nosniff");
    expect(autorisee.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(autorisee.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const inconnue = await request(app.getHttpServer())
      .get("/api/health")
      .set("Origin", "https://origine-inconnue.example");
    expect(inconnue.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("répond 429 par HTTP après cinq échecs de connexion", async () => {
    const pseudo = `limite-${crypto.randomUUID().slice(0, 8)}`;
    const source = creerDataSourceIdentite();
    let utilisateurId: string | undefined;
    try {
      const inscription = await request(app.getHttpServer())
        .post("/api/identite/inscription")
        .send({ pseudo, motDePasse: "mot-de-passe-de-test-long", langue: "fr" });
      expect(inscription.status).toBe(201);
      utilisateurId = inscription.body.profil.identite.id as string;

      for (let tentative = 0; tentative < 5; tentative += 1) {
        const connexion = await request(app.getHttpServer())
          .post("/api/identite/connexion")
          .send({ identifiant: pseudo, motDePasse: "incorrect" });
        expect(connexion.status).toBe(401);
      }
      const limite = await request(app.getHttpServer())
        .post("/api/identite/connexion")
        .send({ identifiant: pseudo.toUpperCase(), motDePasse: "incorrect" });
      expect(limite.status).toBe(429);
      expect(limite.body).toMatchObject({
        code: "AUTHENTIFICATION_LIMITEE",
        statut: 429,
      });
    } finally {
      if (utilisateurId !== undefined) {
        await source.initialize();
        await source.query(`DELETE FROM "ide"."compte" WHERE "utilisateur_id" = $1`, [
          utilisateurId,
        ]);
        await source.destroy();
      }
    }
  }, 30_000);
});
