import { randomUUID } from "node:crypto";

import { schemaPaquetScenario } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import {
  DepotCampagneTypeorm,
  creerDataSourceCampagne,
  type MissionCampagne,
} from "../src/index.js";

function codeErreur(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  const detail = "driverError" in cause ? cause.driverError : cause;
  if (
    typeof detail !== "object" ||
    detail === null ||
    !("code" in detail) ||
    typeof detail.code !== "string"
  ) {
    return undefined;
  }
  return detail.code;
}

async function postgresDisponible(): Promise<boolean> {
  const source = creerDataSourceCampagne();
  try {
    await source.initialize();
    await source.query("SELECT 1");
    return true;
  } catch (cause) {
    if (
      ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH"].includes(codeErreur(cause) ?? "")
    ) {
      return false;
    }
    throw cause;
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

const pg = await postgresDisponible();

describe.skipIf(!pg)("CAM — persistance PostgreSQL", () => {
  it("conserve la sauvegarde, le journal append-only et la progression", async () => {
    const depot = new DepotCampagneTypeorm();
    const source = creerDataSourceCampagne();
    const utilisateurId = randomUUID();
    const missionId = randomUUID();
    const secondeMissionId = randomUUID();
    const scenarioId = randomUUID();
    const objectifId = randomUUID();
    const paquet = schemaPaquetScenario.parse({
      version: "1.0.0",
      id: scenarioId,
      cible: "lune",
      budgetMaxMUSD: 100,
      objectifs: [
        {
          id: objectifId,
          titre: "Objectif",
          questionScientifique: "Question",
          role: "principal",
        },
      ],
      catalogueAutorise: [randomUUID()],
      actes: Array.from({ length: 7 }, (_, numero) => ({
        id: randomUUID(),
        numero,
        titre: { fr: "Acte", en: "Act" },
        type: "briefing",
        description: { fr: "Préparation.", en: "Preparation." },
      })),
      definitionsEvenements: [],
      fins: ["A", "B", "C", "D"].map((code) => ({
        code,
        titre: { fr: `Fin ${code}`, en: `Ending ${code}` },
        regles: [{ type: "missionPerdue" }],
        conclusion: { fr: "Fin.", en: "Ending." },
      })),
      conditionsDeblocage: [],
    });
    const mission: MissionCampagne = {
      id: missionId,
      utilisateurId,
      scenarioId,
      versionScenario: "1.0.0",
      versionCatalogue: "1.0.0",
      graine: 123,
      acte: 4,
      configurationId: randomUUID(),
      scenario: paquet,
      configuration: null,
      etatSimulation: JSON.stringify({ jour: 4 }),
      resultat: null,
      bilan: null,
      rapportJson: null,
      terminee: false,
    };
    const sauvegarde = {
      ...mission,
      acte: 5 as const,
      etatSimulation: JSON.stringify({ jour: 5 }),
    };
    const secondeMission = { ...mission, id: secondeMissionId };
    const journalId = randomUUID();
    const deuxiemeJournalId = randomUUID();
    try {
      await depot.creerMission(mission);
      await depot.creerMission(secondeMission);
      await depot.enregistrerMission(sauvegarde);
      await depot.ajouterAuJournal(missionId, {
        id: journalId,
        acte: 4,
        libelle: "DECISION_CONSIGNEE",
        effets: [{ version: 1, code: "DECISION_CONSIGNEE", params: { jour: 4 } }],
        date: new Date().toISOString(),
      });
      await depot.ajouterAuJournal(missionId, {
        id: deuxiemeJournalId,
        acte: 5,
        libelle: "ACTE_5",
        effets: [],
        date: new Date().toISOString(),
      });
      await depot.enregistrerProgression({
        utilisateurId,
        scenarioId,
        disponible: true,
        termine: true,
        tentatives: 1,
        meilleurScore: 700,
        meilleureFin: "C",
      });

      expect(await depot.lireMission(missionId)).toEqual(sauvegarde);
      expect(await depot.lireJournal(missionId)).toMatchObject([
        { id: journalId, acte: 4, libelle: "DECISION_CONSIGNEE" },
        { id: deuxiemeJournalId, acte: 5, libelle: "ACTE_5" },
      ]);
      const premierePageJournal = await depot.lirePageJournal(missionId, 1);
      expect(premierePageJournal.items).toMatchObject([{ id: journalId }]);
      expect(premierePageJournal.nextCursor).not.toBeNull();
      expect(
        await depot.lirePageJournal(missionId, 1, premierePageJournal.nextCursor ?? undefined),
      ).toMatchObject({ items: [{ id: deuxiemeJournalId }], nextCursor: null });
      const premierePageMission = await depot.listerMissions(utilisateurId, 1);
      expect(premierePageMission.items).toHaveLength(1);
      expect(premierePageMission.nextCursor).not.toBeNull();
      expect(
        await depot.listerMissions(
          utilisateurId,
          1,
          premierePageMission.nextCursor ?? undefined,
        ),
      ).toMatchObject({ items: [{ id: expect.any(String) }], nextCursor: null });
      expect(await depot.lireProgressions(utilisateurId)).toMatchObject([
        { meilleurScore: 700, meilleureFin: "C" },
      ]);

      await source.initialize();
      await expect(
        source.query(
          `UPDATE "cam"."journal_decision" SET "libelle" = 'modifie' WHERE "entree_id" = $1`,
          [journalId],
        ),
      ).rejects.toThrow(/append-only/);
    } finally {
      await depot.onModuleDestroy();
      if (!source.isInitialized) await source.initialize();
      await source.query(
        `ALTER TABLE "cam"."journal_decision" DISABLE TRIGGER "trg_journal_decision_append_only"`,
      );
      await source.query(`DELETE FROM "cam"."journal_decision" WHERE "mission_id" = $1`, [
        missionId,
      ]);
      await source.query(
        `ALTER TABLE "cam"."journal_decision" ENABLE TRIGGER "trg_journal_decision_append_only"`,
      );
      await source.query(
        `DELETE FROM "cam"."progression" WHERE "utilisateur_id" = $1 AND "scenario_id" = $2`,
        [utilisateurId, scenarioId],
      );
      await source.query(`DELETE FROM "cam"."mission" WHERE "mission_id" = $1`, [missionId]);
      await source.query(`DELETE FROM "cam"."mission" WHERE "mission_id" = $1`, [
        secondeMissionId,
      ]);
      await source.destroy();
    }
  });
});
