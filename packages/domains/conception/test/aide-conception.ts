import type { ReferentielCatalogue } from "@smdg/contracts";

import { ConfigurationMission } from "../src/domain/configuration-mission.js";

export function uuid(n: number): string {
  return `${n.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
}

export const IDS = {
  structure: uuid(101),
  panneau: uuid(102),
  batterie: uuid(103),
  propulsion: uuid(104),
  extra: uuid(105),
  camera: uuid(201),
  cameraBassePuissance: uuid(202),
  radar: uuid(203),
  lanceur: uuid(301),
  lanceurIncompatible: uuid(302),
  orbite: uuid(401),
  orbiteElliptique: uuid(402),
  objectif: uuid(501),
  objectifSecondaire: uuid(502),
  objectifIncompatible: uuid(503),
} as const;

export const PROFIL_OPERATIONS_TEST = {
  source: "a-calibrer",
  dureeCibleJours: 365,
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
    [IDS.structure]: 1000,
    [IDS.panneau]: 1000,
    [IDS.batterie]: 1000,
    [IDS.propulsion]: 2000,
    [IDS.camera]: 1000,
  },
  limitesVieJours: {
    degradationPanneaux: 365,
    autonomieCarburant: 365,
    toleranceRadiation: 365,
  },
  crise: {
    delaiDecisionJours: 1,
    facteurTransmission: 0.5,
    dureeSuspensionObservationsJours: 1,
    facteurBasseConsommation: 0.5,
    penaliteRisqueAccru: 0.1,
  },
} as const;

export function catalogueTest(
  overrides: {
    readonly masseStructureKg?: number;
    readonly capaciteBatterieWh?: number;
    readonly capacitePolaireKg?: number;
    readonly capaciteElliptiqueKg?: number;
    readonly ispS?: number;
    readonly incompatiblesAvec?: readonly string[];
  } = {},
): ReferentielCatalogue {
  return {
    version: "2.0.0-test",
    composants: [
      {
        id: IDS.structure,
        source: "a-calibrer",
        categorie: "structure",
        nom: "structure-principale",
        masseKg: overrides.masseStructureKg ?? 80,
        powerW: 0,
        dutyCycle: 1,
        costMUSD: 5,
        fiabilite: 0.99,
        niveau: "decouverte",
      },
      {
        id: IDS.panneau,
        source: "a-calibrer",
        categorie: "energie-panneau",
        nom: "panneau",
        masseKg: 12,
        powerW: 110 / (1 - 0.35), // B4 : production MOYENNE d'orbite = 110 W (ombre 35 %)
        dutyCycle: 1,
        degradationAn: 0,
        costMUSD: 6,
        fiabilite: 0.97,
        niveau: "decouverte",
      },
      {
        id: IDS.batterie,
        source: "a-calibrer",
        categorie: "energie-batterie",
        nom: "batterie",
        masseKg: 9,
        powerW: 0,
        dutyCycle: 1,
        capaciteBatterieWh: overrides.capaciteBatterieWh ?? 400,
        costMUSD: 4,
        fiabilite: 0.96,
        niveau: "decouverte",
      },
      {
        id: IDS.propulsion,
        source: "a-calibrer",
        categorie: "propulsion",
        nom: "moteur",
        masseKg: 12,
        powerW: 0,
        dutyCycle: 1,
        ispS: overrides.ispS ?? 300,
        costMUSD: 12,
        fiabilite: 0.94,
        niveau: "ingenieur",
      },
      {
        id: IDS.extra,
        source: "a-calibrer",
        categorie: "structure",
        nom: "renfort",
        masseKg: 10,
        powerW: 4,
        dutyCycle: 1,
        costMUSD: 2,
        fiabilite: 0.98,
        niveau: "expert",
      },
    ],
    instruments: [
      {
        id: IDS.camera,
        source: "a-calibrer",
        nom: "camera",
        masseKg: 18,
        powerW: 96,
        dutyCycle: 1,
        costMUSD: 15,
        dataMbps: 2,
        valeurScientifique: 0.9,
        fiabilite: 0.95,
        ...(overrides.incompatiblesAvec !== undefined
          ? { incompatiblesAvec: [...overrides.incompatiblesAvec] }
          : {}),
      },
      {
        id: IDS.cameraBassePuissance,
        source: "a-calibrer",
        nom: "camera-basse-puissance",
        masseKg: 8,
        powerW: 4,
        dutyCycle: 1,
        costMUSD: 8,
        dataMbps: 1,
        valeurScientifique: 0.5,
        fiabilite: 0.96,
      },
      {
        id: IDS.radar,
        source: "a-calibrer",
        nom: "radar",
        masseKg: 12,
        powerW: 25,
        dutyCycle: 1,
        costMUSD: 12,
        dataMbps: 3,
        valeurScientifique: 0.8,
        fiabilite: 0.93,
      },
    ],
    orbites: [
      {
        id: IDS.orbite,
        source: "a-calibrer",
        type: "polaire",
        altitudeKm: 100,
        inclinaisonDeg: 90,
        periodeS: 7065.7,
        fractionOmbre: 0.35,
        tempsContactSolMin: 4.47,
        couverture: 0.9,
      },
      {
        id: IDS.orbiteElliptique,
        source: "a-calibrer",
        type: "elliptique",
        altitudeKm: 150,
        inclinaisonDeg: 30,
        periodeS: 7356.1,
        fractionOmbre: 0.33,
        tempsContactSolMin: 6.12,
        couverture: 0.8,
      },
    ],
    lanceurs: [
      {
        id: IDS.lanceur,
        source: "a-calibrer",
        nom: "lanceur-moyen",
        classe: "moyen",
        capaciteKg: {
          polaire: overrides.capacitePolaireKg ?? 420,
          elliptique: overrides.capaciteElliptiqueKg ?? 400,
        },
        costMUSD: 30,
        fiabilite: 0.95,
      },
      {
        id: IDS.lanceurIncompatible,
        source: "a-calibrer",
        nom: "lanceur-leger",
        classe: "leger",
        capaciteKg: { polaire: 200 },
        costMUSD: 15,
        fiabilite: 0.93,
      },
    ],
    stationsSol: [],
    seuils: { alerteOrange: 0.9, alerteRouge: 1, margeFaible: 0.9 },
  };
}

export function creerConfiguration(
  overrides: {
    readonly configurationId?: string;
    readonly catalogue?: ReferentielCatalogue;
    readonly masseStructureKg?: number;
    readonly capaciteBatterieWh?: number;
    readonly capacitePolaireKg?: number;
    readonly ispS?: number;
    readonly budgetMaxMUSD?: number;
    readonly deltaVms?: number;
    readonly difficulte?: "decouverte" | "ingenieur" | "expert";
    readonly inclureElements?: boolean;
    readonly inclureInstrument?: boolean;
    readonly objectifPrincipal?: string | undefined;
    readonly objectifsSecondaires?: readonly string[];
  } = {},
): ConfigurationMission {
  const catalogue =
    overrides.catalogue ??
    catalogueTest({
      ...(overrides.masseStructureKg !== undefined
        ? { masseStructureKg: overrides.masseStructureKg }
        : {}),
      ...(overrides.capaciteBatterieWh !== undefined
        ? { capaciteBatterieWh: overrides.capaciteBatterieWh }
        : {}),
      ...(overrides.capacitePolaireKg !== undefined
        ? { capacitePolaireKg: overrides.capacitePolaireKg }
        : {}),
      ...(overrides.ispS !== undefined ? { ispS: overrides.ispS } : {}),
    });
  const configuration = new ConfigurationMission({
    catalogue,
    configurationId: overrides.configurationId ?? uuid(601),
    scenarioId: uuid(602),
    versionScenario: "1.0.0",
    budgetMaxMUSD: overrides.budgetMaxMUSD ?? 100,
    deltaVms: overrides.deltaVms ?? 0,
    margeDv: 0.1,
    dureeMissionAns: 1,
    coutOperationsAnnuelMUSD: 0,
    profondeurDecharge: 0.5,
    rendement: 0.9,
    tempsObservationSParJour: 3600,
    difficulte: overrides.difficulte ?? "expert",
    profilOperations: structuredClone(PROFIL_OPERATIONS_TEST),
  });

  const objectifPrincipal = Object.hasOwn(overrides, "objectifPrincipal")
    ? overrides.objectifPrincipal
    : IDS.objectif;
  configuration.choisirObjectifs(
    objectifPrincipal,
    overrides.objectifsSecondaires ?? [IDS.objectifSecondaire],
  );
  if (overrides.inclureElements !== false) {
    configuration.ajouterElement(IDS.structure);
    configuration.ajouterElement(IDS.panneau);
    configuration.ajouterElement(IDS.batterie);
    configuration.ajouterElement(IDS.propulsion);
  }
  if (overrides.inclureInstrument !== false) {
    configuration.ajouterInstrument(IDS.camera);
    if (objectifPrincipal !== undefined) {
      configuration.associerObjectifsInstrument(IDS.camera, [objectifPrincipal]);
    }
  }
  configuration.choisirLancement(IDS.lanceur, IDS.orbite);
  return configuration;
}
