import { gzipSync } from "node:zlib";

import { schemaPaquetScenario } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import {
  creerConfiguration,
  IDS as IDS_CONCEPTION,
  uuid,
} from "../../../packages/domains/conception/test/aide-conception.js";
import type { EntreeJournal, MissionCampagne } from "@smdg/campagne";
import { creerVueMission } from "../src/vue-mission.js";

describe("P7 — VueMission", () => {
  it("inclut les quatre blocs et respecte la périodicité orbitale et le poids cible", () => {
    const configuration = creerConfiguration().figer();
    const scenario = schemaPaquetScenario.parse({
      version: "1.0.0",
      id: configuration.scenarioId,
      cible: "lune",
      budgetMaxMUSD: 100,
      objectifs: [
        {
          id: IDS_CONCEPTION.objectif,
          titre: "Objectif principal",
          questionScientifique: "Question scientifique",
          role: "principal",
        },
      ],
      catalogueAutorise: [IDS_CONCEPTION.structure],
      actes: Array.from({ length: 7 }, (_, numero) => ({
        id: uuid(820 + numero),
        numero,
        titre: { fr: `Acte ${numero}`, en: `Act ${numero}` },
        type: "briefing",
        description: { fr: "Préparation.", en: "Preparation." },
      })),
      definitionsEvenements: [],
      fins: ["A", "B", "C", "D"].map((code) => ({
        code,
        titre: { fr: `Fin ${code}`, en: `Ending ${code}` },
        regles: [],
        conclusion: { fr: "Conclusion.", en: "Conclusion." },
      })),
      conditionsDeblocage: [],
    });
    const mission: MissionCampagne = {
      id: uuid(840),
      utilisateurId: uuid(841),
      scenarioId: scenario.id,
      versionScenario: "1.0.0",
      versionCatalogue: "2.0.0-test",
      graine: 123,
      acte: 4,
      configurationId: configuration.configurationId,
      scenario,
      configuration,
      etatSimulation: null,
      resultat: null,
      bilan: null,
      rapportJson: null,
      terminee: false,
    };
    const journal: EntreeJournal[] = [
      {
        id: uuid(850),
        acte: 0,
        libelle: "MISSION_CREEE",
        effets: [],
        date: new Date(0).toISOString(),
      },
      {
        id: uuid(851),
        acte: 3,
        libelle: "CONCEPTION_VALIDEE",
        effets: [],
        date: new Date(1).toISOString(),
      },
      {
        id: uuid(852),
        acte: 5,
        libelle: "BILAN",
        effets: [],
        date: new Date(2).toISOString(),
      },
      {
        id: uuid(853),
        acte: 6,
        libelle: "MISSION_TERMINEE",
        effets: [],
        date: new Date(3).toISOString(),
      },
    ];

    const vue = creerVueMission(mission, journal);
    const rayonCibleKm = configuration.orbite.altitudeKm + 1737.1;
    expect(vue).toMatchObject({
      concept: { missionId: mission.id, scenarioId: scenario.id },
      trajectoires: { referentiel: "lune-centre-inertiel" },
      scene3d: { corpsCeleste: { nom: "Lune" } },
    });
    expect(vue.chronologie.map((entree) => entree.segment)).toEqual([
      "lancement",
      "spatial",
      "sol",
      "utilisateurs",
    ]);
    for (const point of vue.trajectoires.positions) {
      const rayon = Math.hypot(
        point.positionKm.xKm,
        point.positionKm.yKm,
        point.positionKm.zKm,
      );
      expect(Math.abs(rayon - rayonCibleKm) / rayonCibleKm).toBeLessThan(1e-6);
    }
    expect(gzipSync(JSON.stringify(vue)).byteLength).toBeLessThan(200_000);
  });
});
