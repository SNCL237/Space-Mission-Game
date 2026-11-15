import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  schemaBilanMission,
  schemaCodeExplication,
  schemaConfigurationFigee,
  schemaDecisionEquipe,
  schemaEvenementDomaine,
  schemaIdentiteUtilisateur,
  schemaPaquetScenario,
  schemaReferentielCatalogue,
  schemaResultatSimulation,
  schemaVueMission,
} from "../src/index.js";

/** UUID v4 de test (version 4, variante 8-b). */
function uuid(n: number): string {
  return `${n.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
}

const texte = { fr: "Texte", en: "Text" } as const;

interface ContratDeTest {
  readonly nom: string;
  readonly schema: z.ZodType;
  readonly exemple: Record<string, unknown>;
}

// Exemples « producteur » : un objet produit par le domaine déclaré au §4 d'Agent.md.
const CONTRATS: readonly ContratDeTest[] = [
  {
    nom: "C1",
    schema: schemaReferentielCatalogue,
    exemple: {
      version: "1.0.0",
      composants: [
        {
          id: uuid(1),
          source: "a-calibrer",
          categorie: "structure",
          nom: "structure-principale",
          masseKg: 80,
          powerW: 0,
          dutyCycle: 1,
          costMUSD: 5,
          fiabilite: 0.99,
          niveau: "decouverte",
        },
      ],
      instruments: [
        {
          id: uuid(2),
          source: "a-calibrer",
          nom: "spectrometre-neutronique",
          masseKg: 14,
          powerW: 22,
          dutyCycle: 1,
          costMUSD: 8,
          dataMbps: 4,
          valeurScientifique: 0.6,
          fiabilite: 0.95,
        },
      ],
      orbites: [
        {
          id: uuid(3),
          source: "a-calibrer",
          type: "polaire",
          altitudeKm: 100,
          inclinaisonDeg: 90,
          periodeS: 7065.7,
          fractionOmbre: 0.35,
          tempsContactSolMin: 4.47,
          couverture: 0.9,
        },
      ],
      lanceurs: [
        {
          id: uuid(4),
          source: "a-calibrer",
          nom: "lanceur-moyen",
          classe: "moyen",
          capaciteKg: { polaire: 420, circulaireBasse: 450, elliptique: 400 },
          costMUSD: 30,
          fiabilite: 0.95,
        },
      ],
      stationsSol: [{ id: uuid(5), source: "a-calibrer", nom: "station-1", dataMbps: 100 }],
      seuils: { alerteOrange: 0.9, erreurRouge: 1 },
    },
  },
  {
    nom: "C2",
    schema: schemaPaquetScenario,
    exemple: {
      version: "1.0.0",
      id: uuid(1),
      cible: "lune",
      budgetMaxMUSD: 100,
      objectifs: [
        {
          id: uuid(2),
          titre: "Recherche de glace d'eau",
          questionScientifique: "Q ?",
          role: "principal",
        },
      ],
      catalogueAutorise: [uuid(3)],
      actes: Array.from({ length: 7 }, (_, numero) => ({
        id: uuid(10 + numero),
        numero,
        titre: texte,
        type: "recit",
        description: texte,
      })),
      definitionsEvenements: [
        {
          id: uuid(4),
          type: "PANNE_EMETTEUR_RADAR",
          origine: "systeme",
          probabilite: 0.05,
          impact: "instrument",
          indice: "le debit de la liaison chute",
          cibleId: uuid(2),
          ampleur: 0.5,
        },
      ],
      fins: ["A", "B", "C", "D"].map((code) => ({
        code,
        titre: texte,
        regles: [{ type: "objectifs-atteints", seuilScore: 700 }],
        conclusion: texte,
      })),
      conditionsDeblocage: [{ id: uuid(5), type: "fin", finMinimale: "C" }],
    },
  },
  {
    nom: "C3",
    schema: schemaConfigurationFigee,
    exemple: {
      version: 1,
      configurationId: uuid(1),
      scenarioId: uuid(2),
      versionScenario: "1.0.0",
      versionCatalogue: "1.0.0",
      orbiteur: {
        masseSecheKg: 310,
        carburantKg: 80.96,
        puissanceProduiteW: 110,
        puissanceConsommeeW: 96,
        capaciteBatterieWh: 146.5,
        coutMUSD: 78,
        elements: [
          {
            idCatalogue: uuid(3),
            categorie: "structure",
            masseKg: 80,
            powerW: 0,
            dutyCycle: 1,
            costMUSD: 5,
            fiabilite: 0.99,
          },
        ],
        instruments: [
          {
            idCatalogue: uuid(4),
            masseKg: 14,
            powerW: 22,
            dutyCycle: 1,
            costMUSD: 8,
            dataMbps: 4,
            valeurScientifique: 0.6,
            fiabilite: 0.95,
          },
        ],
      },
      orbite: { type: "polaire", altitudeKm: 100, inclinaisonDeg: 90, fractionEclipse: 0.35 },
      lanceur: { id: uuid(5), capaciteKg: 420, fiabilite: 0.95 },
      objectifs: { principal: uuid(6), secondaires: [uuid(7)] },
      margeDv: 0.1,
      difficulte: "ingenieur",
      bilans: [{ type: "puissance", capacite: 110, consomme: 96, seuilAlerte: 0.9 }],
      profilOperations: {
        source: "a-calibrer",
        dureeCibleJours: 365,
        batterieInitialeWh: 146.5,
        capaciteStockageGbit: 1000,
        debitLiaisonMbps: 100,
        tempsContactSParJour: 21600,
        tempsObservationSParJour: 3600,
        reserveDeltaVms: 1000,
        ispS: 300,
        seuilBatterieDegrade: 0.5,
        seuilBatterieCritique: 0.2,
        mtbfJoursParSysteme: { [uuid(3)]: 1000, [uuid(4)]: 2000 },
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
      },
    },
  },
  {
    nom: "C4",
    schema: schemaResultatSimulation,
    exemple: {
      version: 1,
      simulationId: uuid(1),
      graine: 20261114,
      dureeSimuleeJours: 180,
      issue: "nominale",
      serie: [
        {
          jour: 1,
          puissanceW: 110,
          batterieWh: 140,
          tamponGbit: 12,
          science: 3.5,
          donneesGenereesGbit: 20,
          donneesTransmisesGbit: 8,
          donneesPerduesGbit: 0,
        },
      ],
      evenements: [
        {
          id: uuid(2),
          type: "PANNE_EMETTEUR_RADAR",
          jour: 42,
          origine: "systeme",
          impact: "instrument",
          indice: "un signal de panne a été détecté",
          cibleId: uuid(4),
          ampleur: 1,
        },
      ],
      decisionsCrise: [{ id: uuid(3), choix: "basse-consommation", jour: 42 }],
      sousSystemes: { [uuid(4)]: "operationnel" },
      scienceCumulee: 640,
      scienceMax: 1000,
      donneesPerduesGbit: 12,
      donneesGenereesGbit: 120,
      donneesTransmisesGbit: 108,
      carburantRestantKg: 40,
    },
  },
  {
    nom: "C5",
    schema: schemaBilanMission,
    exemple: {
      version: 1,
      missionRef: uuid(1),
      scoreTotal: 760,
      scores: { science: 200, technique: 200, ressources: 150, fiabilite: 130, collab: 80 },
      fin: "B",
      causes: [{ version: 1, code: "BUDGET_UTILISE_ELEVE", params: { pourcent: 92 } }],
      decisionsCles: [uuid(2)],
      recommandations: [
        { version: 1, code: "RECHARGER_MARGE_BUDGET", params: { piste: "reduire-instrument" } },
      ],
    },
  },
  {
    nom: "C6",
    schema: schemaDecisionEquipe,
    exemple: {
      version: 1,
      propositionId: uuid(1),
      missionId: uuid(2),
      delta: { operation: "remplacer", idCatalogue: uuid(3) },
    },
  },
  {
    nom: "C7",
    schema: schemaCodeExplication,
    exemple: { version: 1, code: "MASSE_DEPASSE", params: { ecartKg: 10 } },
  },
  {
    nom: "C8",
    schema: schemaIdentiteUtilisateur,
    exemple: { version: 1, id: uuid(1), langue: "fr" },
  },
  {
    nom: "C9",
    schema: schemaEvenementDomaine,
    exemple: {
      type: "MissionLancée",
      version: 1,
      missionId: uuid(1),
      simulationId: uuid(2),
      graine: 42,
    },
  },
  {
    nom: "C10",
    schema: schemaVueMission,
    exemple: {
      version: 1,
      concept: {
        missionId: uuid(1),
        scenarioId: uuid(2),
        cible: "lune",
        objectifs: [{ id: uuid(3), titre: "Objectif", role: "principal" }],
      },
      trajectoires: {
        referentiel: "lune-centre-inertiel",
        orbite: { altitudeKm: 100, inclinaisonDeg: 90, periodeS: 7065.7 },
        positions: [
          { tempsS: 0, positionKm: { xKm: 1837.1, yKm: 0, zKm: 0 } },
          { tempsS: 1, positionKm: { xKm: 1837.1, yKm: 0, zKm: 0 } },
        ],
      },
      chronologie: [],
      scene3d: {
        corpsCeleste: { nom: "Lune", rayonKm: 1737.1 },
        engin: { id: uuid(1), trajectoireId: "orbite-principale" },
      },
      notesModele: ["Modèle simplifié."],
    },
  },
];

/**
 * Matrice producteur → consommateurs (tableau §4 d'Agent.md).
 * ATTENTION : transcription manuelle — ce test garde la taille et la cohérence
 * de la matrice, il ne prouve pas qu'un domaine consommateur sait lire le
 * contrat ; cette preuve (« chaque consommateur sait le lire », Agent.md §14)
 * se fait domaine par domaine à partir de P2, où chaque consommateur importe
 * le contrat et parse son propre fixture.
 */
const MATRICE = [
  { contrat: "C1", producteur: "CAT", consommateurs: ["CON", "SCE"] },
  { contrat: "C2", producteur: "SCE", consommateurs: ["CAM", "CON", "EVA"] },
  { contrat: "C3", producteur: "CON", consommateurs: ["CAM", "SIM"] },
  { contrat: "C4", producteur: "SIM", consommateurs: ["CAM", "EVA"] },
  { contrat: "C5", producteur: "EVA", consommateurs: ["CAM", "CLA", "PED"] },
  { contrat: "C6", producteur: "EQU", consommateurs: ["CON"] },
  { contrat: "C7", producteur: "tous", consommateurs: ["PED"] },
  { contrat: "C8", producteur: "IDE", consommateurs: ["tous"] },
  { contrat: "C9", producteur: "tous", consommateurs: ["CAM", "PED", "CLA"] },
] as const;

function contrat(nom: string): ContratDeTest {
  const trouve = CONTRATS.find((c) => c.nom === nom);
  if (!trouve) throw new Error(`Contrat inconnu : ${nom}`);
  return trouve;
}

describe("contrats — gel C1 à C10", () => {
  it("T1-01 : chaque contrat C1 à C10 porte un champ `version` obligatoire", () => {
    expect(CONTRATS.map((c) => c.nom)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "C10",
    ]);
    for (const c of CONTRATS) {
      // 1. une instance valide passe le schéma ;
      expect(c.schema.safeParse(c.exemple).success, `${c.nom} : exemple valide`).toBe(true);
      // 2. une instance sans `version` échoue sur le CHAMP `version`.
      const sansVersion: Record<string, unknown> = { ...c.exemple };
      delete sansVersion.version;
      const resultat = c.schema.safeParse(sansVersion);
      expect(resultat.success, `${c.nom} : sans version`).toBe(false);
      if (!resultat.success) {
        const chemin = resultat.error.issues[0]?.path;
        if (c.nom === "C5") {
          expect(chemin === undefined || chemin.length === 0 || chemin[0] === "version").toBe(true);
        } else {
          expect(chemin, `${c.nom} : chemin du champ`).toEqual(["version"]);
        }
      }
    }
  });

  it("T1-02 : 100 % des paires producteur/consommateur du tableau §4 passent", () => {
    let paires = 0;
    for (const ligne of MATRICE) {
      const c = contrat(ligne.contrat);
      for (const consommateur of ligne.consommateurs) {
        paires += 1;
        const resultat = c.schema.safeParse(c.exemple);
        expect(resultat.success, `${ligne.contrat} : ${ligne.producteur} → ${consommateur}`).toBe(
          true,
        );
        if (resultat.success) {
          expect(resultat.data, `${ligne.contrat} → ${consommateur} : lecture identique`).toEqual(
            c.exemple,
          );
        }
      }
    }
    expect(paires).toBe(18);
  });

  it("T1-03 : instantanés des schémas — toute modification non versionnée échoue", () => {
    const projections = Object.fromEntries(CONTRATS.map((c) => [c.nom, c.schema.toJSONSchema()]));
    expect(projections).toMatchSnapshot();
  });

  it("C5 v2 : le mode solo est versionné et le total reste additif", () => {
    const solo = schemaBilanMission.safeParse({
      version: 2,
      mode: "solo",
      missionRef: uuid(1),
      scoreTotal: 500,
      scores: {
        science: (300 * 1000 * 0.5) / 900,
        technique: (250 * 1000 * 0.5) / 900,
        ressources: (200 * 1000 * 0.5) / 900,
        fiabilite: (150 * 1000 * 0.5) / 900,
        collab: 0,
      },
      fin: "B",
      causes: [],
      decisionsCles: [],
      recommandations: [],
    });
    expect(solo.success).toBe(true);

    if (solo.success) {
      expect(schemaBilanMission.safeParse({ ...solo.data, scoreTotal: 501 }).success).toBe(false);
    }
    expect(schemaBilanMission.safeParse(contrat("C5").exemple).success).toBe(true);
  });

  it("C1/C3 : les facteurs d'utilisation optionnels sont bornés", () => {
    const c1 = contrat("C1").exemple;
    const composant = (c1["composants"] as Record<string, unknown>[])[0]!;
    expect(contrat("C1").schema.safeParse(c1).success).toBe(true);
    const c1Historique = structuredClone(c1);
    delete (c1Historique["composants"] as Record<string, unknown>[])[0]!["dutyCycle"];
    expect(contrat("C1").schema.safeParse(c1Historique).success).toBe(true);
    const cycleC1Invalide = structuredClone(c1);
    (cycleC1Invalide["composants"] as Record<string, unknown>[])[0]!["dutyCycle"] = 1.1;
    expect(contrat("C1").schema.safeParse(cycleC1Invalide).success).toBe(false);

    const c3 = contrat("C3").exemple;
    const instrument = (
      (c3["orbiteur"] as Record<string, unknown>)["instruments"] as Record<string, unknown>[]
    )[0]!;
    const cycleC3Invalide = structuredClone(c3);
    (
      (cycleC3Invalide["orbiteur"] as Record<string, unknown>)["instruments"] as Record<
        string,
        unknown
      >[]
    )[0]!["dutyCycle"] = 1.1;
    expect(contrat("C3").schema.safeParse(cycleC3Invalide).success).toBe(false);
    const c3Historique = structuredClone(c3);
    delete c3Historique["profilOperations"];
    expect(contrat("C3").schema.safeParse(c3Historique).success).toBe(true);
    expect(instrument["dutyCycle"]).toBe(1);
    expect(composant["dutyCycle"]).toBe(1);
  });

  it("T1-18 : les jetons de ports sont des `symbol` uniques et tous distincts", async () => {
    const { JETONS_DE_PORTS } = await import("../src/index.js");
    expect(JETONS_DE_PORTS).toHaveLength(10);
    for (const jeton of JETONS_DE_PORTS) {
      expect(typeof jeton).toBe("symbol");
      expect(jeton.constructor).toBe(Symbol);
    }
    expect(new Set(JETONS_DE_PORTS).size).toBe(JETONS_DE_PORTS.length);
  });
});
