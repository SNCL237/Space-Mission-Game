import "reflect-metadata";

import { HttpException, Logger, type ArgumentsHost, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import { ErreurIdentite } from "@smdg/identite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../src/app.module.js";
import { FiltreExceptions } from "../src/infra/exception.filter.js";

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

let app: INestApplication;

async function jetonJoueur(): Promise<string> {
  return new SignJWT({ role: "joueur" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("11111111-1111-4111-8111-111111111111")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("P7 — enveloppe d'erreur HTTP", () => {
  it("structure les erreurs 400, 401, 403 et 404", async () => {
    const serveur = app.getHttpServer();
    const invalide = await request(serveur).post("/api/health/echo").send({ message: 42 });
    const nonAuthentifie = await request(serveur).get("/api/identite/profil");
    const interdit = await request(serveur)
      .get("/api/catalogue/versions")
      .set("Authorization", `Bearer ${await jetonJoueur()}`);
    const absent = await request(serveur).get("/api/route-absente");

    for (const [reponse, statut] of [
      [invalide, 400],
      [nonAuthentifie, 401],
      [interdit, 403],
      [absent, 404],
    ] as const) {
      expect(reponse.status).toBe(statut);
      expect(reponse.body).toEqual({
        code: expect.any(String),
        params: expect.any(Object),
        statut,
      });
    }
  });

  it("convertit une erreur serveur en 500 générique sans exposer son message", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;
    const journaliser = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    try {
      new FiltreExceptions().catch(new Error("internal-secret"), host);
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        code: "ERREUR_INTERNE",
        params: {},
        statut: 500,
      });
      expect(journaliser).toHaveBeenCalled();
    } finally {
      journaliser.mockRestore();
    }
  });

  it("préserve les erreurs métier structurées et leur statut", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new FiltreExceptions().catch(
      new HttpException(
        { code: "CONFIGURATION_NON_VALIDEE", params: { codes: "MASSE_DEPASSEE" }, statut: 422 },
        422,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      code: "CONFIGURATION_NON_VALIDEE",
      params: { codes: "MASSE_DEPASSEE" },
      statut: 422,
    });
  });

  it("préserve le statut 409 et le code d'un conflit métier", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new FiltreExceptions().catch(
      new ErreurIdentite({ version: 1, code: "COMPTE_DEJA_EXISTANT", params: {} }, 409),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      code: "COMPTE_DEJA_EXISTANT",
      params: {},
      statut: 409,
    });
  });
});
