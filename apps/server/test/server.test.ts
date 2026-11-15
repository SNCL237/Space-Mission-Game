import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EVENT_BUS, type BusEvenements, type EvenementDomaine } from "@smdg/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { creerDocumentOpenApi, monterOpenApi } from "../src/openapi.js";

// Variable obligatoire (T1-16) : fournie pour tous les tests sauf le dédié,
// qui la retire pour vérifier l'échec au démarrage.
process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-9222-222222222222";

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  monterOpenApi(app);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("apps/server — P1 (T1-14 → T1-17)", () => {
  it("T1-14 : GET /api/health renvoie 200 ; l'OpenAPI généré est valide (OpenAPI 3)", async () => {
    const sante = await request(app.getHttpServer()).get("/api/health");
    expect(sante.status).toBe(200);
    expect(sante.body).toEqual({ statut: "ok" });

    const document = creerDocumentOpenApi(app);
    expect(document.openapi).toMatch(/^3\.\d+\.\d+$/);
    expect(document.info.title).toBe("THE LAST LIGHT — API");
    expect(Object.keys(document.paths)).toContain("/api/health");
    expect(document.paths["/api/health"]?.get).toBeDefined();

    const documentHttp = await request(app.getHttpServer()).get("/docs-json");
    expect(documentHttp.status).toBe(200);
    expect(documentHttp.body.openapi).toMatch(/^3\./);
  });

  it("T1-15 : corps de requête invalide sur la route d'essai → { code, params, statut: 400 }", async () => {
    const invalide = await request(app.getHttpServer())
      .post("/api/health/echo")
      .send({ message: 42 });
    expect(invalide.status).toBe(400);
    expect(typeof invalide.body.code).toBe("string");
    expect(Array.isArray(invalide.body.params.champs)).toBe(true);
    expect(invalide.body.statut).toBe(400);

    // Un corps valide passe (le pipe ne bloque que l'invalidité).
    const valide = await request(app.getHttpServer())
      .post("/api/health/echo")
      .send({ message: "ok" });
    expect(valide.status).toBe(200);
    expect(valide.body).toEqual({ message: "ok" });
  });

  it("T1-16 : démarrer sans variable obligatoire échoue en nommant la variable", async () => {
    const sauvegarde = process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGINS;
    const demarrage = async (): Promise<void> => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const sansCors = moduleRef.createNestApplication();
      await sansCors.init();
      await sansCors.close();
    };
    try {
      await expect(demarrage()).rejects.toThrow(/CORS_ORIGINS/);
    } finally {
      if (sauvegarde !== undefined) process.env.CORS_ORIGINS = sauvegarde;
    }
  });

  it("T1-17 : EVENT_BUS publie un événement typé ; une charge invalide est refusée", () => {
    const bus = app.get<BusEvenements>(EVENT_BUS);
    const recus: EvenementDomaine[] = [];
    const desabonner = bus.souscrire("MissionLancée", (evenement) => recus.push(evenement));

    const evenement: EvenementDomaine = {
      type: "MissionLancée",
      version: 1,
      missionId: UUID_A,
      simulationId: UUID_B,
      graine: 42,
    };
    bus.publier(evenement);
    expect(recus).toEqual([evenement]);

    // Charge invalide (missionId sans format UUID v4) : refusée, rien n'est livré,
    // avec l'enveloppe structurée `{ code, params, statut }` (Agent.md §11).
    const invalide = {
      type: "MissionLancée",
      version: 1,
      missionId: "pas-un-uuid",
      simulationId: UUID_B,
      graine: 42,
    } as unknown as EvenementDomaine;
    let levee: unknown;
    try {
      bus.publier(invalide);
    } catch (e) {
      levee = e;
    }
    expect(levee).toBeInstanceOf(HttpException);
    expect((levee as HttpException).getResponse()).toMatchObject({
      code: "CHARGE_EVENEMENT_INVALIDE",
      statut: 422,
    });
    expect(recus).toHaveLength(1);

    // Désabonnement effectif.
    desabonner();
    bus.publier(evenement);
    expect(recus).toHaveLength(1);
  });
});
