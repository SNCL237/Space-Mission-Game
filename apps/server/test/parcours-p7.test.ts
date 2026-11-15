import "reflect-metadata";

import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EVENT_BUS, type BusEvenements, type EvenementDomaine } from "@smdg/contracts";
import { creerDataSourceCampagne } from "@smdg/campagne";
import { creerDataSourceCatalogue } from "@smdg/catalogue";
import { ServiceConception } from "@smdg/conception";
import { creerDataSourceIdentite } from "@smdg/identite";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";

process.env.CORS_ORIGINS ??= "http://localhost:5173";
process.env.JWT_SECRET ??= "test-secret-for-jwt-verifier-only-32bytes";

const ID_OBJECTIF = "0b7e0001-0000-4000-8000-000000000000";
const IDS = {
  structure: "c0de0001-0000-4000-8000-000000000000",
  panneau: "c0de0003-0000-4000-8000-000000000000",
  batterie: "c0de0005-0000-4000-8000-000000000000",
  propulsion: "c0de000d-0000-4000-8000-000000000000",
  camera: "1a570001-0000-4000-8000-000000000000",
  lanceurMoyen: "1a4c0002-0000-4000-8000-000000000000",
  lanceurLeger: "1a4c0001-0000-4000-8000-000000000000",
  orbitePolaire: "02610001-0000-4000-8000-000000000000",
} as const;

const profilOperations = {
  source: "a-calibrer",
  dureeCibleJours: 2,
  batterieInitialeWh: 200,
  capaciteStockageGbit: 1000,
  debitLiaisonMbps: 100,
  tempsContactSParJour: 21600,
  tempsObservationSParJour: 3600,
  reserveDeltaVms: 1000,
  ispS: 300,
  seuilBatterieDegrade: 0.5,
  seuilBatterieCritique: 0.2,
  mtbfJoursParSysteme: {
    [IDS.structure]: 1_000_000,
    [IDS.panneau]: 1_000_000,
    [IDS.batterie]: 1_000_000,
    [IDS.propulsion]: 1_000_000,
    [IDS.camera]: 1_000_000,
  },
  limitesVieJours: {
    degradationPanneaux: 2,
    autonomieCarburant: 2,
    toleranceRadiation: 2,
  },
  crise: {
    delaiDecisionJours: 2,
    facteurTransmission: 0.5,
    dureeSuspensionObservationsJours: 1,
    facteurBasseConsommation: 0.5,
    penaliteRisqueAccru: 0.1,
  },
};

let app: INestApplication | undefined;
let tokenJoueur: string;
let utilisateurId: string;
let scenarioId: string;
let versionScenario: string;
const missionsTest: string[] = [];

async function postgresDisponible(): Promise<boolean> {
  const source = creerDataSourceCatalogue();
  try {
    await source.initialize();
    await source.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

const pg = await postgresDisponible();

async function jeton(role: "admin" | "joueur", sujet: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sujet)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

function serveur(): ReturnType<INestApplication["getHttpServer"]> {
  if (app === undefined) throw new Error("APPLICATION_NON_INITIALISEE");
  return app.getHttpServer();
}

async function creerConfiguration(options: {
  readonly budgetMaxMUSD?: number;
  readonly deltaVms?: number;
  readonly lanceurId?: string;
  readonly batterieInitialeWh?: number;
} = {}): Promise<string> {
  const configurationId = randomUUID();
  const creation = await request(serveur())
    .post("/api/conception/configurations")
    .set("Authorization", `Bearer ${tokenJoueur}`)
    .send({
      configurationId,
      scenarioId,
      versionScenario,
      versionCatalogue: "1.2.0",
      budgetMaxMUSD: options.budgetMaxMUSD ?? 100,
      deltaVms: options.deltaVms ?? 0,
      margeDv: 0,
      dureeMissionAns: 1,
      coutOperationsAnnuelMUSD: 0,
      profondeurDecharge: 0.5,
      rendement: 0.9,
      tempsObservationSParJour: 3600,
      difficulte: "expert",
      profilOperations: {
        ...profilOperations,
        batterieInitialeWh: options.batterieInitialeWh ?? 200,
      },
    });
  expect(creation.status).toBe(201);

  const modifier = async (corps: object): Promise<void> => {
    const response = await request(serveur())
      .patch(`/api/conception/configurations/${configurationId}`)
      .set("Authorization", `Bearer ${tokenJoueur}`)
      .send(corps);
    expect(response.status).toBe(200);
  };
  await modifier({ type: "objectifs", principal: ID_OBJECTIF, secondaires: [] });
  await modifier({
    type: "lancement",
    lanceurId: options.lanceurId ?? IDS.lanceurMoyen,
    orbiteId: IDS.orbitePolaire,
  });
  for (const id of [IDS.structure, IDS.panneau, IDS.batterie, IDS.propulsion]) {
    await modifier({ type: "ajouter-element", id });
  }
  await modifier({ type: "ajouter-instrument", id: IDS.camera });
  await modifier({
    type: "associer-objectifs-instrument",
    id: IDS.camera,
    objectifs: [ID_OBJECTIF],
  });

  const lecture = await request(serveur())
    .get(`/api/conception/configurations/${configurationId}`)
    .set("Authorization", `Bearer ${tokenJoueur}`);
  const conception = app?.get<ServiceConception>(ServiceConception);
  if (conception === undefined) throw new Error("SERVICE_CONCEPTION_ABSENT");
  expect(lecture.status).toBe(200);
  expect(lecture.body).toEqual(conception.lire(configurationId));

  const mission = await request(serveur())
    .post("/api/campagne/missions")
    .set("Authorization", `Bearer ${tokenJoueur}`)
    .send({
      scenarioId,
      versionScenario,
      versionCatalogue: "1.2.0",
      configurationId,
      graine: 123,
    });
  expect(mission.status).toBe(201);
  const missionId = mission.body.id as string;
  missionsTest.push(missionId);
  return missionId;
}

async function avancerJusquaLancement(missionId: string): Promise<request.Response> {
  for (const acte of [1, 2]) {
    const response = await request(serveur())
      .post(`/api/campagne/missions/${missionId}/actes`)
      .set("Authorization", `Bearer ${tokenJoueur}`)
      .send({ acte });
    expect(response.status).toBe(201);
  }
  return request(serveur())
    .post(`/api/campagne/missions/${missionId}/actes`)
    .set("Authorization", `Bearer ${tokenJoueur}`)
    .send({ acte: 3 });
}

describe.skipIf(!pg)("P7 — parcours HTTP et contrôles métier", () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const adminToken = await jeton("admin", randomUUID());
    const importCatalogue = await request(serveur())
      .post("/api/catalogue/import")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(importCatalogue.status).toBe(200);
    const importScenarios = await request(serveur())
      .post("/api/scenarios/import")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(importScenarios.status).toBe(200);

    const invite = await request(serveur()).post("/api/identite/invites").send({ langue: "fr" });
    expect(invite.status).toBe(201);
    tokenJoueur = invite.body.jeton as string;
    utilisateurId = invite.body.profil.identite.id as string;

    const scenarios = await request(serveur())
      .get("/api/campagne/scenarios")
      .set("Authorization", `Bearer ${tokenJoueur}`);
    expect(scenarios.status).toBe(200);
    const premier = scenarios.body.items[0] as { scenarioId: string; version: string };
    scenarioId = premier.scenarioId;
    versionScenario = premier.version;
  });

  afterAll(async () => {
    await app?.close();
    if (missionsTest.length > 0) {
      const source = creerDataSourceCampagne();
      await source.initialize();
      try {
        await source.query(
          `ALTER TABLE "cam"."journal_decision" DISABLE TRIGGER "trg_journal_decision_append_only"`,
        );
        await source.query(
          `DELETE FROM "cam"."journal_decision" WHERE "mission_id" = ANY($1::uuid[])`,
          [missionsTest],
        );
        await source.query(
          `ALTER TABLE "cam"."journal_decision" ENABLE TRIGGER "trg_journal_decision_append_only"`,
        );
        await source.query(`DELETE FROM "cam"."progression" WHERE "utilisateur_id" = $1`, [
          utilisateurId,
        ]);
        await source.query(`DELETE FROM "cam"."mission" WHERE "mission_id" = ANY($1::uuid[])`, [
          missionsTest,
        ]);
      } finally {
        await source.destroy();
      }
    }
    if (utilisateurId !== undefined) {
      const source = creerDataSourceIdentite();
      await source.initialize();
      try {
        await source.query(`DELETE FROM "ide"."compte" WHERE "utilisateur_id" = $1`, [
          utilisateurId,
        ]);
      } finally {
        await source.destroy();
      }
    }
  });

  it("valide les configurations avant le lancement, recalcule le bilan et pagine les ressources", async () => {
    const scenarioPage = await request(serveur())
      .get("/api/campagne/scenarios?limite=1")
      .set("Authorization", `Bearer ${tokenJoueur}`);
    expect(scenarioPage.status).toBe(200);
    expect(scenarioPage.body.items).toHaveLength(1);
    expect(scenarioPage.body.nextCursor).toBeTruthy();

    const missionId = await creerConfiguration();
    const bus = app?.get<BusEvenements>(EVENT_BUS);
    if (bus === undefined) throw new Error("BUS_EVENEMENTS_ABSENT");
    const evenementsLancement: EvenementDomaine[] = [];
    const desabonner = bus.souscrire("MissionLancée", (evenement) =>
      evenementsLancement.push(evenement),
    );
    try {
      const lancement = await avancerJusquaLancement(missionId);
      expect(lancement.status, JSON.stringify(lancement.body)).toBe(201);
      expect(evenementsLancement).toHaveLength(1);
      expect(lancement.body.configuration.version).toBe(1);
    } finally {
      desabonner();
    }

    const journalPage = await request(serveur())
      .get(`/api/campagne/missions/${missionId}/journal?limite=1`)
      .set("Authorization", `Bearer ${tokenJoueur}`);
    expect(journalPage.status).toBe(200);
    expect(journalPage.body.items).toHaveLength(1);
    expect(journalPage.body.nextCursor).toMatch(/^[1-9]\d*$/);
    const suiteJournal = await request(serveur())
      .get(
        `/api/campagne/missions/${missionId}/journal?limite=1&curseur=${journalPage.body.nextCursor}`,
      )
      .set("Authorization", `Bearer ${tokenJoueur}`);
    expect(Number(suiteJournal.body.items[0].sequence)).toBeGreaterThan(
      Number(journalPage.body.items[0].sequence),
    );

    await creerConfiguration();
    const missionPage = await request(serveur())
      .get("/api/campagne/missions?limite=1")
      .set("Authorization", `Bearer ${tokenJoueur}`);
    expect(missionPage.status).toBe(200);
    expect(missionPage.body.items).toHaveLength(1);
    expect(missionPage.body.nextCursor).toBeTruthy();

    for (const acte of [4, 5]) {
      const response = await request(serveur())
        .post(`/api/campagne/missions/${missionId}/actes`)
        .set("Authorization", `Bearer ${tokenJoueur}`)
        .send({ acte });
      expect(response.status).toBe(201);
    }
    for (const fauxBilan of [{ scoreTotal: 1000 }, { bilan: { scoreTotal: 1000 } }]) {
      const response = await request(serveur())
        .post(`/api/campagne/missions/${missionId}/cloturer`)
        .set("Authorization", `Bearer ${tokenJoueur}`)
        .send(fauxBilan);
      expect(response.status).toBe(400);
      expect(response.body.statut).toBe(400);
    }
    const cloture = await request(serveur())
      .post(`/api/campagne/missions/${missionId}/actes`)
      .set("Authorization", `Bearer ${tokenJoueur}`)
      .send({ acte: 6 });
    expect(cloture.status).toBe(201);
    expect(cloture.body.bilan.scoreTotal).toBeGreaterThanOrEqual(0);
    expect(cloture.body.bilan.scoreTotal).toBeLessThanOrEqual(1000);
  }, 60_000);

  it("refuse les lancements hors masse et budget avec leurs codes bloquants", async () => {
    const cas = [
      {
        options: { deltaVms: 8000, lanceurId: IDS.lanceurLeger },
        code: "MASSE_DEPASSE",
      },
      { options: { budgetMaxMUSD: 1 }, code: "BUDGET_DEPASSE" },
    ] as const;

    for (const { options, code } of cas) {
      const missionId = await creerConfiguration(options);
      const lancement = await avancerJusquaLancement(missionId);
      expect(lancement.status, JSON.stringify(lancement.body)).toBe(422);
      expect(lancement.body).toMatchObject({
        code: "CONFIGURATION_NON_VALIDEE",
        params: { codes: expect.stringContaining(code) },
        statut: 422,
      });
    }
  }, 60_000);

  it("refuse de poursuivre une crise sans décision du joueur", async () => {
    const missionId = await creerConfiguration({ batterieInitialeWh: 0 });
    const lancement = await avancerJusquaLancement(missionId);
    expect(lancement.status, JSON.stringify(lancement.body)).toBe(201);
    const operation = await request(serveur())
      .post(`/api/campagne/missions/${missionId}/actes`)
      .set("Authorization", `Bearer ${tokenJoueur}`)
      .send({ acte: 4 });
    expect(operation.status).toBe(201);

    // B2 : le profil d'opérations est fixé par le serveur (batterie pleine au départ). On avance
    // jour par jour jusqu'à la première crise réelle, puis on vérifie qu'avancer sans décider échoue.
    let refus: request.Response | undefined;
    for (let jour = 0; jour < 30 && refus === undefined; jour++) {
      const avance = await request(serveur())
        .post(`/api/campagne/missions/${missionId}/simulation`)
        .set("Authorization", `Bearer ${tokenJoueur}`)
        .send({ commandes: [], jours: 1 });
      if (avance.status === 422) refus = avance;
      else expect(avance.status, JSON.stringify(avance.body)).toBe(201);
    }
    expect(refus, "une crise doit survenir pendant la mission").toBeDefined();
    expect(refus?.body).toMatchObject({ code: "DECISION_ATTENDUE", statut: 422 });
  }, 60_000);
});
