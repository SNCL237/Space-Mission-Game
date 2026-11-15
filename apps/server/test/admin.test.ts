import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { creerDataSourceCatalogue } from "@smdg/catalogue";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";

// Routes d'administration : sans jeton 401, rôle joueur 403, rôle admin 200.
// Les cas 200 touchent la base et se sautent sans PostgreSQL.

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

const cleTest = new TextEncoder().encode(process.env.JWT_SECRET);

async function jeton(role: "admin" | "joueur"): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("11111111-1111-4111-8111-111111111111")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(cleTest);
}

let app: INestApplication;

async function postgresDisponible(): Promise<boolean> {
  const source = creerDataSourceCatalogue();
  try {
    await source.initialize();
    await source.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await source.destroy();
    } catch {
      // Non initialisée : rien à fermer.
    }
  }
}

const pg = await postgresDisponible();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("T2-16 — contrôle d'accès des routes d'administration", () => {
  it("sans Bearer JWT, une valeur x-role ne donne aucun accès", async () => {
    const catalogue = await request(app.getHttpServer()).get("/api/catalogue/versions");
    expect(catalogue.status).toBe(401);
    expect(catalogue.body.statut).toBe(401);
    expect(typeof catalogue.body.code).toBe("string");

    // Le garde tourne avant le pipe : même sans corps, 401 et non 400.
    const scenarios = await request(app.getHttpServer()).post("/api/scenarios/valider");
    expect(scenarios.status).toBe(401);
    expect(scenarios.body.statut).toBe(401);

    const roleProvisoire = await request(app.getHttpServer())
      .get("/api/catalogue/versions")
      .set("x-role", "admin");
    expect(roleProvisoire.status).toBe(401);
  });

  it("un JWT joueur → 403 sur chaque route d'administration", async () => {
    const bearer = `Bearer ${await jeton("joueur")}`;
    const catalogue = await request(app.getHttpServer())
      .get("/api/catalogue/versions")
      .set("Authorization", bearer);
    expect(catalogue.status).toBe(403);
    expect(catalogue.body.statut).toBe(403);

    const valider = await request(app.getHttpServer())
      .post("/api/scenarios/valider")
      .set("Authorization", bearer)
      .send({});
    expect(valider.status).toBe(403);

    const importer = await request(app.getHttpServer())
      .post("/api/scenarios/import")
      .set("Authorization", bearer);
    expect(importer.status).toBe(403);
  });

  it("T2-16 : les routes publiques restent ouvertes (santé)", async () => {
    const sante = await request(app.getHttpServer()).get("/api/health");
    expect(sante.status).toBe(200);
  });
});

describe.skipIf(!pg)("T2-16 — rôle admin (PostgreSQL)", () => {
  it("un JWT administrateur → 200 sur catalogue et scénarios", async () => {
    const bearer = `Bearer ${await jeton("admin")}`;
    // 1. Import du catalogue (F2.2) puis lecture des versions (F2.3).
    const importCatalogue = await request(app.getHttpServer())
      .post("/api/catalogue/import")
      .set("Authorization", bearer);
    expect(importCatalogue.status).toBe(200);
    expect(importCatalogue.body.importe).toBe(true);

    const versions = await request(app.getHttpServer())
      .get("/api/catalogue/versions")
      .set("Authorization", bearer);
    expect(versions.status).toBe(200);
    expect(versions.body.versions).toContain("1.2.0");

    // 2. Validation A11 d'un corps imparfait : 200, toutes les erreurs listées.
    const valider = await request(app.getHttpServer())
      .post("/api/scenarios/valider")
      .set("Authorization", bearer)
      .send({});
    expect(valider.status).toBe(200);
    expect(valider.body.valide).toBe(false);
    expect(valider.body.erreurs.length).toBeGreaterThan(0);

    // 3. Import des paquets du disque (A11) : le paquet lunaire est publié.
    const importScenarios = await request(app.getHttpServer())
      .post("/api/scenarios/import")
      .set("Authorization", bearer);
    expect(importScenarios.status).toBe(200);
    expect(importScenarios.body.publie).toBeGreaterThanOrEqual(1);
    expect(importScenarios.body.erreurs).toEqual([]);
  });
});
