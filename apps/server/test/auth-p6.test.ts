import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IDENTITE_PORT, type PortIdentite, type ProfilIdentite } from "@smdg/contracts";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ErreurCampagne, ServiceCampagne } from "@smdg/campagne";
import { AppModule } from "../src/app.module.js";

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

const UTILISATEUR_ID = "11111111-1111-4111-8111-111111111111";
const MISSION_ID = "22222222-2222-4222-9222-222222222222";
const cle = new TextEncoder().encode(process.env.JWT_SECRET);
const profil: ProfilIdentite = {
  identite: { version: 1, id: UTILISATEUR_ID, langue: "fr" },
  pseudo: "Invite-test",
  invite: true,
};

async function jeton(role: "admin" | "joueur", utilisateurId = UTILISATEUR_ID): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(utilisateurId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(cle);
}

let app: INestApplication;
const lireMission = vi.fn(async (utilisateurId: string, missionId: string) => {
  if (utilisateurId !== UTILISATEUR_ID) {
    throw new ErreurCampagne({ version: 1, code: "MISSION_INCONNUE", params: {} }, 404);
  }
  return { utilisateurId, missionId };
});

beforeAll(async () => {
  const identite: PortIdentite = {
    creerInvite: async () => ({ profil, jeton: await jeton("joueur") }),
    inscrire: async () => ({ profil, jeton: await jeton("joueur") }),
    connecter: async () => ({ profil, jeton: await jeton("joueur") }),
    lireProfil: async () => profil,
    definirLangue: async (_id, langue) => ({
      ...profil,
      identite: { ...profil.identite, langue },
    }),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(IDENTITE_PORT)
    .useValue(identite)
    .overrideProvider(ServiceCampagne)
    .useValue({ lireMission })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("P6 — contrôles Bearer et identité du propriétaire", () => {
  it("crée un invité public sans e-mail puis authentifie son profil avec le jeton", async () => {
    const invite = await request(app.getHttpServer())
      .post("/api/identite/invites")
      .send({ langue: "fr" });
    expect(invite.status).toBe(201);
    expect(invite.body.profil.invite).toBe(true);
    expect(invite.body.profil.courriel).toBeUndefined();
    expect(invite.body.jeton).toBeTruthy();

    const profilHttp = await request(app.getHttpServer())
      .get("/api/identite/profil")
      .set("Authorization", `Bearer ${invite.body.jeton}`);
    expect(profilHttp.status).toBe(200);
    expect(profilHttp.body.identite.id).toBe(UTILISATEUR_ID);
  });

  it("ignore x-role et exige un jeton de joueur valide pour les missions", async () => {
    const sansJeton = await request(app.getHttpServer())
      .get(`/api/campagne/missions/${MISSION_ID}`)
      .set("x-role", "joueur");
    expect(sansJeton.status).toBe(401);

    const admin = await request(app.getHttpServer())
      .get(`/api/campagne/missions/${MISSION_ID}`)
      .set("Authorization", `Bearer ${await jeton("admin")}`);
    expect(admin.status).toBe(403);

    const joueur = await request(app.getHttpServer())
      .get(`/api/campagne/missions/${MISSION_ID}`)
      .set("Authorization", `Bearer ${await jeton("joueur")}`);
    expect(joueur.status).toBe(200);
    expect(lireMission).toHaveBeenCalledWith(UTILISATEUR_ID, MISSION_ID);

    const autreProprietaire = await request(app.getHttpServer())
      .get(`/api/campagne/missions/${MISSION_ID}`)
      .set(
        "Authorization",
        `Bearer ${await jeton("joueur", "33333333-3333-4333-8333-333333333333")}`,
      );
    expect(autreProprietaire.status).toBe(404);
    expect(autreProprietaire.body.code).toBe("MISSION_INCONNUE");
  });
});
