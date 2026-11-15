import {
  CODES_EVALUATION_TOUTES,
  type BusEvenements,
  type EntreeEvaluation,
  type EvenementDomaine,
  schemaBilanMission,
} from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ServiceEvaluation } from "../src/application/service-evaluation.js";
import { evaluerBilan, exporterRapportJson, genererRapport } from "../src/domain/evaluation.js";
import { schemaRapportMission } from "../src/domain/rapport.js";

const uuid = (value: number): string =>
  `${value.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;

const IDS = {
  scenario: uuid(1),
  mission: uuid(2),
  configuration: uuid(3),
  instrumentPrincipal: uuid(4),
  instrumentSecondaire: uuid(5),
  structure: uuid(6),
  launcher: uuid(7),
  objectivePrincipal: uuid(8),
  objectiveSecondaire: uuid(9),
};

function entree(
  options: {
    readonly mode?: "solo" | "equipe";
    readonly sciencePrincipale?: number;
    readonly scienceSecondaire?: number;
    readonly disponibilite?: number;
    readonly marge?: number;
    readonly coutMUSD?: number;
    readonly donneesGenereesGbit?: number;
    readonly donneesPerduesGbit?: number;
    readonly mtbfJours?: number;
    readonly decisionRisque?: boolean;
    readonly issue?: "nominale" | "ecourtee" | "perdue";
    readonly missionsReelles?: readonly string[];
  } = {},
): EntreeEvaluation {
  const sciencePrincipale = options.sciencePrincipale ?? 1;
  const scienceSecondaire = options.scienceSecondaire ?? 1;
  const maximum = 100;
  const objectifPrincipal = IDS.objectivePrincipal;
  const objectifSecondaire = IDS.objectiveSecondaire;
  const configuration: EntreeEvaluation["configuration"] = {
    version: 1,
    configurationId: IDS.configuration,
    scenarioId: IDS.scenario,
    versionScenario: "1.0.0",
    versionCatalogue: "1.0.0",
    orbiteur: {
      masseSecheKg: 100,
      carburantKg: 20,
      puissanceProduiteW: 100,
      puissanceConsommeeW: 20,
      capaciteBatterieWh: 400,
      coutMUSD: options.coutMUSD ?? 0,
      elements: [
        {
          idCatalogue: IDS.structure,
          categorie: "structure",
          masseKg: 80,
          powerW: 20,
          dutyCycle: 1,
          costMUSD: 0,
          fiabilite: 1,
        },
      ],
      instruments: [
        {
          idCatalogue: IDS.instrumentPrincipal,
          objectifs: [objectifPrincipal],
          ...(options.missionsReelles !== undefined
            ? { missionsReelles: [...options.missionsReelles] }
            : {}),
          masseKg: 10,
          powerW: 10,
          dutyCycle: 1,
          costMUSD: 0,
          dataMbps: 10,
          valeurScientifique: 100,
          fiabilite: 1,
        },
        {
          idCatalogue: IDS.instrumentSecondaire,
          objectifs: [objectifSecondaire],
          masseKg: 10,
          powerW: 10,
          dutyCycle: 1,
          costMUSD: 0,
          dataMbps: 10,
          valeurScientifique: 100,
          fiabilite: 1,
        },
      ],
    },
    orbite: { type: "polaire", altitudeKm: 100, inclinaisonDeg: 90, fractionEclipse: 0.4 },
    lanceur: { id: IDS.launcher, capaciteKg: 500, fiabilite: 1 },
    objectifs: { principal: objectifPrincipal, secondaires: [objectifSecondaire] },
    margeDv: 1000,
    difficulte: "expert",
    bilans: [],
    profilOperations: {
      source: "fixture-test",
      dureeCibleJours: 1,
      batterieInitialeWh: 400,
      capaciteStockageGbit: 1000,
      debitLiaisonMbps: 100,
      tempsContactSParJour: 21600,
      tempsObservationSParJour: 3600,
      reserveDeltaVms: 1000,
      ispS: 300,
      seuilBatterieDegrade: 0.5,
      seuilBatterieCritique: 0.2,
      mtbfJoursParSysteme: {
        [IDS.structure]: options.mtbfJours ?? 1e12,
        [IDS.instrumentPrincipal]: 1e12,
        [IDS.instrumentSecondaire]: 1e12,
      },
      limitesVieJours: {
        degradationPanneaux: 1,
        autonomieCarburant: 1,
        toleranceRadiation: 1,
      },
      crise: {
        delaiDecisionJours: 1,
        facteurTransmission: 0.5,
        dureeSuspensionObservationsJours: 1,
        facteurBasseConsommation: 0.5,
        penaliteRisqueAccru: 0.1,
      },
    },
  };
  const donneesGenereesGbit = options.donneesGenereesGbit ?? 100;
  const serie = [
    {
      jour: 1,
      puissanceW: 100,
      batterieWh: 400,
      tamponGbit: 0,
      science: maximum * (sciencePrincipale + scienceSecondaire),
      scienceParObjectif: {
        [objectifPrincipal]: maximum * sciencePrincipale,
        [objectifSecondaire]: maximum * scienceSecondaire,
      },
      disponibilite: options.disponibilite ?? 1,
      marges: {
        batterie: options.marge ?? 1,
        stockage: options.marge ?? 1,
        deltaV: options.marge ?? 1,
        carburant: options.marge ?? 1,
      },
      donneesGenereesGbit,
      donneesTransmisesGbit: donneesGenereesGbit - (options.donneesPerduesGbit ?? 0),
      donneesPerduesGbit: options.donneesPerduesGbit ?? 0,
    },
  ];
  return {
    missionId: IDS.mission,
    mode: options.mode ?? "equipe",
    ...(options.mode === "solo" ? {} : { collaboration: { tauxParticipation: 1, conflits: 0 } }),
    scenario: {
      version: "1.0.0",
      id: IDS.scenario,
      cible: "lune",
      budgetMaxMUSD: 100,
      catalogueAutorise: [uuid(10)],
      objectifs: [
        {
          id: objectifPrincipal,
          titre: "Objectif principal",
          questionScientifique: "Question principale",
          role: "principal",
        },
        {
          id: objectifSecondaire,
          titre: "Objectif secondaire",
          questionScientifique: "Question secondaire",
          role: "secondaire",
        },
      ],
      actes: Array.from({ length: 7 }, (_, numero) => ({
        id: uuid(20 + numero),
        numero,
        titre: { fr: `Acte ${numero}`, en: `Act ${numero}` },
        type: "briefing",
        description: { fr: "Description", en: "Description" },
      })),
      definitionsEvenements: [],
      fins: [
        {
          code: "A",
          titre: { fr: "Fin A", en: "Ending A" },
          regles: [
            { type: "scienceMinimale", seuil: 0.8 },
            { type: "budgetRespecte", seuil: 1 },
            { type: "objectifsAtteints", minimum: 2 },
          ],
          conclusion: { fr: "Conclusion", en: "Conclusion" },
        },
        {
          code: "B",
          titre: { fr: "Fin B", en: "Ending B" },
          regles: [{ type: "scienceMinimale", seuil: 0.6 }],
          conclusion: { fr: "Conclusion", en: "Conclusion" },
        },
        {
          code: "C",
          titre: { fr: "Fin C", en: "Ending C" },
          regles: [{ type: "scienceMinimale", seuil: 0.35 }],
          conclusion: { fr: "Conclusion", en: "Conclusion" },
        },
        {
          code: "D",
          titre: { fr: "Fin D", en: "Ending D" },
          regles: [{ type: "missionPerdue", seuil: 1 }],
          conclusion: { fr: "Conclusion", en: "Conclusion" },
        },
      ],
      conditionsDeblocage: [],
    },
    configuration,
    resultat: {
      version: 1,
      simulationId: uuid(11),
      graine: 123,
      dureeSimuleeJours: 1,
      issue: options.issue ?? "nominale",
      serie,
      evenements: [],
      decisionsCrise: options.decisionRisque
        ? [{ id: uuid(12), choix: "poursuivre", jour: 1 }]
        : [],
      sousSystemes: {
        [IDS.structure]: "operationnel",
        [IDS.instrumentPrincipal]: "operationnel",
        [IDS.instrumentSecondaire]: "operationnel",
      },
      scienceCumulee: maximum * (sciencePrincipale + scienceSecondaire),
      scienceMax: maximum * 2,
      donneesPerduesGbit: options.donneesPerduesGbit ?? 0,
      donneesGenereesGbit,
      donneesTransmisesGbit: donneesGenereesGbit - (options.donneesPerduesGbit ?? 0),
      carburantRestantKg: 20,
      progressionScientifiqueParObjectif: {
        [objectifPrincipal]: {
          cumulee: maximum * sciencePrincipale,
          maximum,
        },
        [objectifSecondaire]: {
          cumulee: maximum * scienceSecondaire,
          maximum,
        },
      },
    },
  };
}

describe("@smdg/evaluation", () => {
  it("scores the worst solo case at zero and offers replay after end D", () => {
    const input = entree({
      mode: "solo",
      sciencePrincipale: 0,
      scienceSecondaire: 0,
      disponibilite: 0,
      marge: 0,
      coutMUSD: 100,
      donneesGenereesGbit: 100,
      donneesPerduesGbit: 100,
      issue: "perdue",
    });
    const bilan = evaluerBilan(input);
    const rapport = genererRapport(input, bilan);

    expect(bilan.scoreTotal).toBe(0);
    expect(bilan.fin).toBe("D");
    expect(bilan.recommandations.length).toBeGreaterThan(0);
    expect(rapport.rejouer).toBe(true);
  });

  it("scores a perfect team mission at 1000 and versions C5 v2", () => {
    const bilan = evaluerBilan(entree());
    expect(bilan.scoreTotal).toBeCloseTo(1000, 5);
    expect(bilan.fin).toBe("A");
    expect(schemaBilanMission.safeParse(bilan).success).toBe(true);
  });

  it("uses 100% of scientific score for the primary objective when no secondary is configured", () => {
    const input = entree({ sciencePrincipale: 1, scienceSecondaire: 0 });
    input.configuration.objectifs.secondaires = [];
    input.configuration.orbiteur.instruments[1]!.objectifs = [IDS.objectivePrincipal];
    input.resultat.progressionScientifiqueParObjectif![IDS.objectivePrincipal] = {
      cumulee: 100,
      maximum: 100,
    };
    const bilan = evaluerBilan(input);
    expect(bilan.scores.science).toBe(300);
  });

  it("applies A7's science, resources and risk-penalized reliability formulas", () => {
    const science = evaluerBilan(entree({ sciencePrincipale: 1, scienceSecondaire: 0 }));
    expect(science.scores.science).toBe(180);

    const ressources = evaluerBilan(
      entree({ coutMUSD: 60, donneesGenereesGbit: 100, donneesPerduesGbit: 10 }),
    );
    expect(ressources.scores.ressources).toBe(130);

    const fiabilite = evaluerBilan(entree({ mtbfJours: 1 / -Math.log(0.8), decisionRisque: true }));
    expect(fiabilite.scores.fiabilite).toBeCloseTo(108, 6);
  });

  it("selects the first satisfied fin in A–D order, including exact threshold boundaries", () => {
    const exact = entree({ sciencePrincipale: 0.8, scienceSecondaire: 0.8 });
    exact.scenario.fins[0]!.regles = [
      { type: "scienceMinimale", seuil: 0.8 },
      { type: "budgetRespecte", seuil: 1 },
    ];
    expect(evaluerBilan(exact).fin).toBe("A");

    const below = entree({ sciencePrincipale: 0.799999, scienceSecondaire: 0.799999 });
    below.scenario.fins[0]!.regles = [
      { type: "scienceMinimale", seuil: 0.8 },
      { type: "budgetRespecte", seuil: 1 },
    ];
    expect(evaluerBilan(below).fin).toBe("B");
  });

  it("redistributes collaboration points proportionally in solo and keeps scores additive", () => {
    const bilan = evaluerBilan(
      entree({
        mode: "solo",
        sciencePrincipale: 0.5,
        scienceSecondaire: 0.5,
        disponibilite: 0.5,
        marge: 0.5,
        coutMUSD: 50,
        donneesGenereesGbit: 100,
        donneesPerduesGbit: 50,
        mtbfJours: 1 / Math.log(2),
      }),
    );
    expect(bilan.scoreTotal).toBeCloseTo(500, 5);
    expect(bilan.scores.collab).toBe(0);
    expect(
      bilan.scores.science +
        bilan.scores.technique +
        bilan.scores.ressources +
        bilan.scores.fiabilite,
    ).toBeCloseTo(bilan.scoreTotal, 5);
  });

  it("exports a deterministic JSON report and only includes catalogue-provided real missions", () => {
    const input = entree({ missionsReelles: ["LRO (LROC)"] });
    input.resultat.evenements.push({
      id: uuid(30),
      type: "EVENEMENT_TEST",
      jour: 1,
      origine: "scenario",
      impact: "donnees",
    });
    input.resultat.decisionsCrise.push({
      id: uuid(31),
      choix: "reduire-transmissions",
      jour: 1,
    });
    const bilan = evaluerBilan(input);
    const rapport = genererRapport(input, bilan);
    const json = exporterRapportJson(rapport);
    expect(schemaRapportMission.parse(JSON.parse(json))).toEqual(rapport);
    expect(rapport.chronologie).toHaveLength(2);
    expect(rapport.missionsReellesComparables).toEqual(["LRO (LROC)"]);
    expect(exporterRapportJson(genererRapport(input, bilan))).toBe(json);

    const sansComparables = genererRapport(entree(), evaluerBilan(entree()));
    expect(sansComparables).not.toHaveProperty("missionsReellesComparables");
  });

  it("publishes BilanPublié once and refuses a conflicting second evaluation", () => {
    const evenements: EvenementDomaine[] = [];
    const bus: BusEvenements = {
      publier(evenement) {
        evenements.push(evenement);
      },
      souscrire() {
        return () => undefined;
      },
    };
    const service = new ServiceEvaluation(bus);
    const input = entree();
    service.evaluer(input);
    service.evaluer(input);
    expect(evenements.filter((event) => event.type === "BilanPublié")).toHaveLength(1);

    expect(() => service.evaluer(entree({ donneesPerduesGbit: 20 }))).toThrow("BILAN_DEJA_PUBLIE");
  });

  it("requires explicit instrument targets and daily technical measures", () => {
    const invalid = entree();
    delete invalid.configuration.orbiteur.instruments[0]!.objectifs;
    expect(() => evaluerBilan(invalid)).toThrow("OBJECTIFS_INSTRUMENT_REQUIS");

    const sansMesuresTechniques = entree();
    delete sansMesuresTechniques.resultat.serie[0]!.disponibilite;
    expect(() => evaluerBilan(sansMesuresTechniques)).toThrow("MESURES_TECHNIQUES_ABSENTES");
  });

  it("only emits cause codes registered for evaluation", () => {
    const bilan = evaluerBilan(
      entree({
        disponibilite: 0.5,
        marge: 0.5,
        coutMUSD: 95,
        donneesPerduesGbit: 20,
        issue: "ecourtee",
      }),
    );
    const connus = new Set(CODES_EVALUATION_TOUTES);
    expect(bilan.causes.every((cause) => connus.has(cause.code))).toBe(true);
    expect(
      bilan.recommandations.every(
        (recommandation) =>
          "pourquoi" in recommandation &&
          connus.has(recommandation.pourquoi.code) &&
          connus.has(recommandation.piste.code),
      ),
    ).toBe(true);
  });
});
