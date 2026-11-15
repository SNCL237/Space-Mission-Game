import { createHash } from "node:crypto";
import { createRequire } from "node:module";

import {
  schemaConfigurationFigee,
  schemaPaquetScenario,
  type EntreeEvaluation,
  type ResultatSimulation,
} from "@smdg/contracts";
import * as evaluationEsm from "@smdg/evaluation";
import * as simulationEsm from "@smdg/simulation";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const evaluationCjs = require("@smdg/evaluation") as typeof import("@smdg/evaluation");
const simulationCjs = require("@smdg/simulation") as typeof import("@smdg/simulation");

const uuid = (numero: number): string =>
  `${numero.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;

const ids = {
  scenario: uuid(1),
  configuration: uuid(2),
  mission: uuid(3),
  simulation: uuid(4),
  structure: uuid(5),
  panneau: uuid(6),
  instrument: uuid(7),
  lanceur: uuid(8),
  objectif: uuid(9),
} as const;

const configuration = schemaConfigurationFigee.parse({
  version: 1,
  configurationId: ids.configuration,
  scenarioId: ids.scenario,
  versionScenario: "1.0.0",
  versionCatalogue: "1.0.0",
  orbiteur: {
    masseSecheKg: 100,
    carburantKg: 20,
    puissanceProduiteW: 120,
    puissanceConsommeeW: 30,
    capaciteBatterieWh: 400,
    coutMUSD: 50,
    elements: [
      {
        idCatalogue: ids.structure,
        categorie: "structure",
        masseKg: 80,
        powerW: 10,
        dutyCycle: 1,
        costMUSD: 10,
        fiabilite: 1,
      },
      {
        idCatalogue: ids.panneau,
        categorie: "energie-panneau",
        masseKg: 10,
        powerW: 120,
        dutyCycle: 1,
        costMUSD: 10,
        fiabilite: 1,
      },
    ],
    instruments: [
      {
        idCatalogue: ids.instrument,
        objectifs: [ids.objectif],
        masseKg: 10,
        powerW: 20,
        dutyCycle: 1,
        costMUSD: 10,
        dataMbps: 2,
        valeurScientifique: 1,
        fiabilite: 1,
      },
    ],
  },
  orbite: { type: "polaire", altitudeKm: 100, inclinaisonDeg: 90, fractionEclipse: 0.35 },
  lanceur: { id: ids.lanceur, capaciteKg: 500, fiabilite: 1 },
  objectifs: { principal: ids.objectif, secondaires: [] },
  margeDv: 1000,
  difficulte: "expert",
  bilans: [{ type: "batterie", capacite: 400, consomme: 100, seuilAlerte: 0.2 }],
  profilOperations: {
    source: "fixture-parite-p7",
    dureeCibleJours: 3,
    batterieInitialeWh: 300,
    capaciteStockageGbit: 100,
    debitLiaisonMbps: 100,
    tempsContactSParJour: 21600,
    tempsObservationSParJour: 3600,
    reserveDeltaVms: 1000,
    ispS: 300,
    seuilBatterieDegrade: 0.5,
    seuilBatterieCritique: 0.2,
    mtbfJoursParSysteme: {
      [ids.structure]: 1_000_000,
      [ids.panneau]: 1_000_000,
      [ids.instrument]: 1_000_000,
    },
    limitesVieJours: {
      degradationPanneaux: 3,
      autonomieCarburant: 3,
      toleranceRadiation: 3,
    },
    crise: {
      delaiDecisionJours: 2,
      facteurTransmission: 0.5,
      dureeSuspensionObservationsJours: 1,
      facteurBasseConsommation: 0.5,
      penaliteRisqueAccru: 0.1,
    },
  },
});

const scenario = schemaPaquetScenario.parse({
  version: "1.0.0",
  id: ids.scenario,
  cible: "lune",
  budgetMaxMUSD: 100,
  objectifs: [
    {
      id: ids.objectif,
      titre: "Objectif principal",
      questionScientifique: "Question scientifique",
      role: "principal",
    },
  ],
  catalogueAutorise: [ids.structure],
  actes: Array.from({ length: 7 }, (_, numero) => ({
    id: uuid(20 + numero),
    numero,
    titre: { fr: `Acte ${numero}`, en: `Act ${numero}` },
    type: "briefing",
    description: { fr: "Préparation.", en: "Preparation." },
  })),
  definitionsEvenements: [],
  fins: ["A", "B", "C", "D"].map((code) => ({
    code,
    titre: { fr: `Fin ${code}`, en: `Ending ${code}` },
    regles:
      code === "A"
        ? [{ type: "missionPerdue", seuil: 1 }]
        : [{ type: "objectifsAtteints", minimum: 0 }],
    conclusion: { fr: "Conclusion.", en: "Conclusion." },
  })),
  conditionsDeblocage: [],
});

function executerSimulation(api: typeof simulationEsm): ResultatSimulation {
  const options = {
    missionId: ids.mission,
    simulationId: ids.simulation,
    graine: 12345,
    configuration,
    definitionsEvenements: [],
  };
  const initial = api.demarrer(options).etat;
  const avance = api.avancer(initial, [], 2).etat;
  return api.terminer(avance);
}

function empreinte(valeur: unknown): string {
  return createHash("sha256").update(JSON.stringify(valeur)).digest("hex");
}

describe("P7 — parité ESM/CJS", () => {
  it("produit les mêmes résultats de simulation et bilans avec le même C3, la même graine et les mêmes commandes", () => {
    const resultatEsm = executerSimulation(simulationEsm);
    const resultatCjs = executerSimulation(simulationCjs);
    const entreeEsm: EntreeEvaluation = {
      missionId: ids.mission,
      mode: "solo",
      scenario,
      configuration,
      resultat: resultatEsm,
    };
    const entreeCjs: EntreeEvaluation = { ...entreeEsm, resultat: resultatCjs };
    const bilanEsm = evaluationEsm.evaluerBilan(entreeEsm);
    const bilanCjs = evaluationCjs.evaluerBilan(entreeCjs);

    expect(empreinte(resultatCjs)).toBe(empreinte(resultatEsm));
    expect(empreinte(bilanCjs)).toBe(empreinte(bilanEsm));
  });
});
