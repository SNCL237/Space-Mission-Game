import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { periode } from "@smdg/physics";
import {
  schemaProfilOperations,
  schemaConfigurationFigee,
  schemaResultatSimulation,
  type ConfigurationFigee,
  type DefinitionEvenement,
  type BusEvenements,
  type EvenementDomaine,
} from "@smdg/contracts";

import { ServiceSimulation } from "../src/application/service-simulation.js";
import {
  avancer,
  calculerDureeEclipseS,
  calculerFiabilite,
  capaciteDescenteGbitJour,
  decider,
  demarrer,
  rehydraterEtatSimulation,
  serialiserEtatSimulation,
  terminer,
} from "../src/domain/simulation.js";
import { ErreurSimulation } from "../src/domain/erreur-simulation.js";

const uuid = (numero: number): string =>
  `${numero.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;

const IDS = {
  structure: uuid(1),
  panneau: uuid(2),
  camera: uuid(3),
  lanceur: uuid(4),
  objectif: uuid(5),
  scenario: uuid(6),
  configuration: uuid(7),
  mission: uuid(8),
  simulation: uuid(9),
};

function configuration(
  options: {
    batterieInitialeWh?: number;
    puissanceProduiteW?: number;
    fiabiliteLanceur?: number;
    dureeCibleJours?: number;
    limiteDegradationPanneaux?: number;
    limiteAutonomieCarburant?: number;
    limiteToleranceRadiation?: number;
    puissanceEquipementW?: number;
    debitLiaisonMbps?: number;
    tempsObservationSParJour?: number;
    capaciteStockageGbit?: number;
    dataMbps?: number;
    valeurScientifique?: number;
    mtbfJoursParSysteme?: Record<string, number>;
    seuilAlerteBatterieWh?: number;
    consommationBatterieWh?: number;
  } = {},
): ConfigurationFigee {
  const dureeCibleJours = options.dureeCibleJours ?? 6;
  return schemaConfigurationFigee.parse({
    version: 1,
    configurationId: IDS.configuration,
    scenarioId: IDS.scenario,
    versionScenario: "1.0.0",
    versionCatalogue: "1.0.0-test",
    orbiteur: {
      masseSecheKg: 100,
      carburantKg: 20,
      puissanceProduiteW: options.puissanceProduiteW ?? 100,
      puissanceConsommeeW: 8,
      capaciteBatterieWh: 400,
      coutMUSD: 50,
      elements: [
        {
          idCatalogue: IDS.structure,
          categorie: "structure",
          masseKg: 50,
          powerW: options.puissanceEquipementW ?? 8,
          dutyCycle: 1,
          costMUSD: 10,
          fiabilite: 1,
        },
        {
          idCatalogue: IDS.panneau,
          categorie: "energie-panneau",
          masseKg: 10,
          powerW: 100,
          dutyCycle: 1,
          costMUSD: 10,
          fiabilite: 1,
        },
      ],
      instruments: [
        {
          idCatalogue: IDS.camera,
          objectifs: [IDS.objectif],
          masseKg: 10,
          powerW: options.puissanceEquipementW ?? 10,
          dutyCycle: 1,
          costMUSD: 10,
          dataMbps: options.dataMbps ?? 2,
          valeurScientifique: options.valeurScientifique ?? 10,
          fiabilite: 1,
        },
      ],
    },
    orbite: {
      type: "polaire",
      altitudeKm: 100,
      inclinaisonDeg: 90,
      fractionEclipse: 0.4,
    },
    lanceur: {
      id: IDS.lanceur,
      capaciteKg: 500,
      fiabilite: options.fiabiliteLanceur ?? 1,
    },
    objectifs: { principal: IDS.objectif, secondaires: [] },
    margeDv: 1000,
    difficulte: "decouverte",
    bilans: [
      {
        type: "batterie",
        capacite: 400,
        consomme: options.consommationBatterieWh ?? 0,
        seuilAlerte: options.seuilAlerteBatterieWh ?? 0.2,
      },
    ],
    profilOperations: {
      source: "a-calibrer",
      dureeCibleJours,
      batterieInitialeWh: options.batterieInitialeWh ?? 400,
      capaciteStockageGbit: options.capaciteStockageGbit ?? 100,
      debitLiaisonMbps: options.debitLiaisonMbps ?? 100,
      tempsContactSParJour: 21600,
      tempsObservationSParJour: options.tempsObservationSParJour ?? 3600,
      reserveDeltaVms: 1000,
      ispS: 300,
      seuilBatterieDegrade: 0.5,
      seuilBatterieCritique: 0.2,
      mtbfJoursParSysteme: options.mtbfJoursParSysteme ?? {
        [IDS.structure]: 1_000_000_000,
        [IDS.panneau]: 1_000_000_000,
        [IDS.camera]: 1_000_000_000,
      },
      limitesVieJours: {
        degradationPanneaux: options.limiteDegradationPanneaux ?? dureeCibleJours,
        autonomieCarburant: options.limiteAutonomieCarburant ?? dureeCibleJours,
        toleranceRadiation: options.limiteToleranceRadiation ?? dureeCibleJours,
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
}

function optionsDemarrage(
  configurationFigee = configuration(),
  definitionsEvenements: DefinitionEvenement[] = [],
) {
  return {
    missionId: IDS.mission,
    simulationId: IDS.simulation,
    graine: 123,
    configuration: configurationFigee,
    definitionsEvenements,
  };
}

describe("@smdg/simulation", () => {
  it("uses deterministic results across uninterrupted and resumed runs", () => {
    const definitions: DefinitionEvenement[] = [
      {
        id: uuid(11),
        type: "TEST_EVENEMENT",
        origine: "scenario",
        probabilite: 1,
        impact: "donnees",
        indice: "indice-test",
        ampleur: 1,
      },
    ];
    const options = optionsDemarrage(configuration(), definitions);
    const initiale = demarrer(options).etat;
    const continuee = avancer(initiale, [], 6).etat;

    const etape = avancer(initiale, [], 2).etat;
    const reprise = rehydraterEtatSimulation(serialiserEtatSimulation(etape));
    const reprisee = avancer(reprise, [], 4).etat;

    expect(terminer(reprisee)).toEqual(terminer(continuee));
    for (let execution = 0; execution < 100; execution += 1) {
      expect(terminer(avancer(demarrer(options).etat, [], 6).etat)).toEqual(terminer(continuee));
    }
    const autreGraine = demarrer({ ...options, graine: 124 }).etat;
    expect(terminer(avancer(autreGraine, [], 6).etat)).not.toEqual(terminer(continuee));
  });

  it("conserves cumulative data across generated, transmitted, buffered and lost amounts", () => {
    const definitions: DefinitionEvenement[] = [
      {
        id: uuid(10),
        type: "PERTE_DONNEES",
        origine: "scenario",
        probabilite: 1,
        impact: "donnees",
        indice: "perte-donnees-imminente",
        ampleur: 1,
      },
    ];
    let etat = demarrer(optionsDemarrage(configuration(), definitions)).etat;
    for (let jour = 0; jour < 6; jour += 1) {
      etat = avancer(etat, [], 1).etat;
      expect(etat.donneesGenereesGbit).toBeCloseTo(
        etat.donneesTransmisesGbit + etat.tamponGbit + etat.donneesPerduesGbit,
        9,
      );
    }
    const resultat = terminer(etat);

    expect(resultat.donneesGenereesGbit).toBeCloseTo(
      resultat.donneesTransmisesGbit! + etat.tamponGbit + resultat.donneesPerduesGbit,
      9,
    );
    expect(etat.evenements[0]?.jour).toBeLessThan(etat.evenements[1]?.jour ?? 0);
    expect(etat.evenements[0]?.type).toMatch(/^INDICE_/);
  });

  it("reports per-objective science, daily availability and normalized margins in C4", () => {
    const etat = demarrer(optionsDemarrage(configuration())).etat;
    const resultat = terminer(avancer(etat, [], 6).etat);
    const progression = resultat.progressionScientifiqueParObjectif?.[IDS.objectif];

    expect(progression?.maximum).toBe(60);
    expect(progression?.cumulee).toBe(resultat.scienceCumulee);
    expect(resultat.serie).toHaveLength(6);
    for (const point of resultat.serie) {
      expect(point.disponibilite).toBeGreaterThanOrEqual(0);
      expect(point.disponibilite).toBeLessThanOrEqual(1);
      expect(point.marges).toMatchObject({
        batterie: expect.any(Number),
        stockage: expect.any(Number),
        deltaV: expect.any(Number),
        carburant: expect.any(Number),
      });
    }
  });

  it("calculates science in proportion to newly transmitted observations", () => {
    const config = configuration({ debitLiaisonMbps: 0.0001 });
    const etat = avancer(demarrer(optionsDemarrage(config)).etat, [], 1).etat;
    const proportionTransmise = etat.donneesTransmisesGbit / etat.donneesGenereesGbit;

    expect(etat.scienceCumulee).toBeCloseTo(10 * proportionTransmise, 12);
    expect(etat.scienceCumulee).toBeLessThanOrEqual(etat.scienceMax);
  });

  it("limits the data buffer and records overflow as lost data", () => {
    const config = configuration({
      capaciteStockageGbit: 1,
      debitLiaisonMbps: 0,
    });
    const etat = avancer(demarrer(optionsDemarrage(config)).etat, [], 1).etat;

    expect(etat.tamponGbit).toBe(1);
    expect(etat.donneesPerduesGbit).toBeCloseTo(etat.donneesGenereesGbit - 1, 9);
  });

  it("applies scheduled observation, transmission and maneuver commands", () => {
    const initiale = demarrer(optionsDemarrage()).etat;
    const jourUn = avancer(
      initiale,
      [
        { type: "planifier-observation", jour: 1, instrumentId: IDS.camera, active: false },
        { type: "programmer-transmission", jour: 1, active: false },
      ],
      1,
    ).etat;
    expect(jourUn.serie[0]?.donneesGenereesGbit).toBe(0);
    expect(jourUn.serie[0]?.donneesTransmisesGbit).toBe(0);

    const jourDeux = avancer(
      jourUn,
      [
        { type: "planifier-observation", jour: 2, instrumentId: IDS.camera, active: true },
        { type: "programmer-transmission", jour: 2, active: true },
        { type: "manoeuvre", jour: 2, deltaVms: 100 },
      ],
      1,
    ).etat;
    expect(jourDeux.serie[1]?.donneesGenereesGbit).toBeGreaterThan(0);
    expect(jourDeux.serie[1]?.donneesTransmisesGbit).toBeGreaterThan(0);
    expect(jourDeux.deltaVRestantMs).toBe(900);
    expect(jourDeux.carburantRestantKg).toBeLessThan(20);
    expect(jourDeux.carburantRestantKg).toBeGreaterThanOrEqual(0);
  });

  it("emits one energy anomaly and requires an explicit decision before its deadline", () => {
    const mauvaisDemarrage = demarrer(
      optionsDemarrage(configuration({ batterieInitialeWh: 0, puissanceProduiteW: 0 })),
    );
    const anomalie = avancer(mauvaisDemarrage.etat, [], 1);
    expect(anomalie.evenements.filter((event) => event.type === "AnomalieDétectée")).toHaveLength(
      1,
    );
    let erreur: unknown;
    try {
      avancer(anomalie.etat, [], 1);
    } catch (exception: unknown) {
      erreur = exception;
    }
    expect(erreur).toMatchObject({ code: "DECISION_ATTENDUE" });

    const decision = decider(anomalie.etat, "basse-consommation");
    expect(decision.etat.decisionsCrise).toHaveLength(1);
    expect(decision.etat.modeBasseConsommation).toBe(true);
    expect(() => decider(decision.etat, "poursuivre")).toThrow(ErreurSimulation);
  });

  it("detects an eclipse deficit and degrades subsystems without exceeding battery bounds", () => {
    const config = configuration({
      batterieInitialeWh: 0,
      puissanceProduiteW: 175,
      puissanceEquipementW: 50,
    });
    const initiale = demarrer(optionsDemarrage(config)).etat;
    const transition = avancer(initiale, [], 1);

    expect(transition.etat.batterieWh).toBeGreaterThan(80);
    expect(transition.etat.batterieWh).toBeLessThan(200);
    expect(transition.etat.sousSystemes[IDS.structure]).toBe("degrade");
    expect(transition.evenements.some((event) => event.type === "AnomalieDétectée")).toBe(true);
    expect(calculerDureeEclipseS(config)).toBeCloseTo(
      periode(config.orbite.altitudeKm) * config.orbite.fractionEclipse,
      8,
    );
  });

  it("records the automatic risk decision when a crisis times out", () => {
    const initiale = demarrer(
      optionsDemarrage(configuration({ batterieInitialeWh: 0, puissanceProduiteW: 0 })),
    ).etat;
    const anomalie = avancer(initiale, [], 1).etat;
    const apresEcheance = avancer(anomalie, [], 2).etat;

    expect(apresEcheance.risqueAccru).toBe(true);
    expect(apresEcheance.decisionsCrise).toContainEqual(
      expect.objectContaining({ choix: "poursuivre" }),
    );
    expect(apresEcheance.decisionsCrise[0]?.jour).toBe(3);
  });

  it("closes at the lifetime limit once a final-day crisis is decided", () => {
    const config = configuration({
      batterieInitialeWh: 0,
      puissanceProduiteW: 0,
      dureeCibleJours: 6,
      limiteDegradationPanneaux: 1,
      limiteAutonomieCarburant: 1,
      limiteToleranceRadiation: 1,
    });
    const anomalie = avancer(demarrer(optionsDemarrage(config)).etat, [], 1).etat;
    const decision = decider(anomalie, "basse-consommation");

    expect(decision.etat.terminee).toBe(true);
    expect(decision.etat.jour).toBe(1);
    expect(decision.etat.issue).toBe("ecourtee");
    expect(decision.evenements[1]?.type).toBe("SimulationTerminée");
  });

  it("rejects maneuvers beyond reserve and calculates reliability and eclipse with physics", () => {
    const initiale = demarrer(optionsDemarrage()).etat;
    let erreur: unknown;
    try {
      avancer(initiale, [{ type: "manoeuvre", jour: 1, deltaVms: 1001 }], 1);
    } catch (exception: unknown) {
      erreur = exception;
    }
    expect(erreur).toMatchObject({ code: "DV_INSUFFISANT" });
    expect(calculerFiabilite([1000, 2000], 100)).toBeCloseTo(0.8607, 4);
    expect(calculerDureeEclipseS(initiale.configuration)).toBeGreaterThan(0);
  });

  it("meets the 0.9 launch reliability tolerance over 10,000 seeds", () => {
    let launchesPerdues = 0;
    for (let graine = 0; graine < 10_000; graine += 1) {
      const etat = demarrer({
        ...optionsDemarrage(configuration({ fiabiliteLanceur: 0.9 })),
        graine,
      }).etat;
      if (etat.issue === "perdue") launchesPerdues += 1;
    }
    expect(launchesPerdues / 10_000).toBeGreaterThanOrEqual(0.085);
    expect(launchesPerdues / 10_000).toBeLessThanOrEqual(0.115);
    expect(demarrer(optionsDemarrage(configuration({ fiabiliteLanceur: 1 }))).etat.issue).toBe(
      "nominale",
    );
  }, 30_000);

  it("keeps subsystem status within power thresholds and selects the earliest life limit", () => {
    const config = configuration({
      batterieInitialeWh: 400,
      puissanceProduiteW: 0,
      puissanceEquipementW: 1,
      dureeCibleJours: 10,
      limiteDegradationPanneaux: 9,
      limiteAutonomieCarburant: 8,
      limiteToleranceRadiation: 7,
    });
    let etat = demarrer(optionsDemarrage(config)).etat;
    expect(etat.limiteJours).toBe(7);
    const batteries: number[] = [];
    const etatsEnergie: string[] = [];
    for (let jour = 0; jour < 7; jour += 1) {
      etat = avancer(etat, [], 1).etat;
      batteries.push(etat.batterieWh);
      etatsEnergie.push(etat.sousSystemes[IDS.structure] ?? "");
    }
    expect(batteries.every((wh) => wh >= 0 && wh <= 400)).toBe(true);
    expect(batteries[0]).toBeLessThan(400);
    expect(etatsEnergie[4]).toBe("degrade");
    expect(etatsEnergie[6]).toBe("critique");
    expect(terminer(etat)).not.toHaveProperty("pertesHumaines");
    expect(schemaResultatSimulation.shape).not.toHaveProperty("pertesHumaines");
  });

  it("records all five crisis choices and applies their distinct effects", () => {
    const optionsCrise = [
      {
        choix: "desactiver-instrument" as const,
        cibleId: IDS.camera,
        verifier: (etat: ReturnType<typeof demarrer>["etat"]) =>
          expect(etat.sousSystemes[IDS.camera]).toBe("horsLigne"),
      },
      {
        choix: "reduire-transmissions" as const,
        cibleId: undefined,
        verifier: (etat: ReturnType<typeof demarrer>["etat"]) =>
          expect(etat.facteurTransmission).toBe(0.5),
      },
      {
        choix: "suspendre-observations" as const,
        cibleId: undefined,
        verifier: (etat: ReturnType<typeof demarrer>["etat"]) =>
          expect(etat.observationsSuspenduesJusqua).toBeGreaterThan(etat.jour),
      },
      {
        choix: "basse-consommation" as const,
        cibleId: undefined,
        verifier: (etat: ReturnType<typeof demarrer>["etat"]) =>
          expect(etat.modeBasseConsommation).toBe(true),
      },
      {
        choix: "poursuivre" as const,
        cibleId: undefined,
        verifier: (etat: ReturnType<typeof demarrer>["etat"]) =>
          expect(etat.risqueAccru).toBe(true),
      },
    ];
    for (const option of optionsCrise) {
      const initiale = demarrer(
        optionsDemarrage(configuration({ batterieInitialeWh: 0, puissanceProduiteW: 0 })),
      ).etat;
      const anomalie = avancer(initiale, [], 1).etat;
      const decision = decider(anomalie, option.choix, option.cibleId);
      expect(decision.etat.decisionsCrise).toHaveLength(1);
      expect(decision.evenements[0]?.type).toBe("CriseDécidée");
      option.verifier(decision.etat);
    }
  });

  it("checks indices across 1,000 seeded runs before applying critical events", () => {
    const definitions: DefinitionEvenement[] = [
      {
        id: uuid(30),
        type: "PANNE_EMETTEUR_RADAR",
        origine: "scenario",
        probabilite: 0.2,
        impact: "instrument",
        indice: "bruit-inhabituel",
        cibleId: IDS.camera,
      },
    ];
    let nbEvenementsAppliques = 0;
    for (let graine = 0; graine < 1000; graine += 1) {
      const etat = avancer(
        demarrer({ ...optionsDemarrage(configuration(), definitions), graine }).etat,
        [],
        6,
      ).etat;
      const indices = etat.evenements.filter((event) => event.type.startsWith("INDICE_"));
      const appliques = etat.evenements.filter((event) => event.type === "PANNE_EMETTEUR_RADAR");
      nbEvenementsAppliques += appliques.length;
      expect(
        appliques.every((event) =>
          indices.some(
            (indice) => indice.type === `INDICE_${event.type}` && indice.jour < event.jour,
          ),
        ),
      ).toBe(true);
    }
    expect(nbEvenementsAppliques).toBeGreaterThan(0);
  }, 30_000);

  it("omits scenario events targeting an instrument outside the frozen configuration", () => {
    const definition: DefinitionEvenement = {
      id: uuid(31),
      type: "PANNE_INSTRUMENT_ABSENT",
      origine: "scenario",
      probabilite: 1,
      impact: "instrument",
      indice: "un indice",
      cibleId: uuid(32),
    };

    expect(demarrer(optionsDemarrage(configuration(), [definition])).etat.definitionsEvenements).toEqual(
      [],
    );
  });

  it("applies the calibrated increased-risk penalty to subsequent component failures", () => {
    let failuresWithRisk = 0;
    let failuresWithoutRisk = 0;
    const mtbf = {
      [IDS.structure]: 2,
      [IDS.panneau]: 1_000_000_000,
      [IDS.camera]: 1_000_000_000,
    };
    for (let graine = 0; graine < 1000; graine += 1) {
      const base = optionsDemarrage(
        configuration({
          batterieInitialeWh: 40,
          puissanceProduiteW: 0,
          puissanceEquipementW: 0,
          consommationBatterieWh: 100,
          mtbfJoursParSysteme: mtbf,
        }),
      );
      const etatInitial = demarrer({ ...base, graine }).etat;
      const crise = avancer(etatInitial, [], 1).etat;
      const risque = decider(crise, "poursuivre").etat;
      const nominal = decider(crise, "basse-consommation").etat;
      failuresWithRisk += Number(
        avancer(risque, [], 1).etat.sousSystemes[IDS.structure] === "horsLigne",
      );
      failuresWithoutRisk += Number(
        avancer(nominal, [], 1).etat.sousSystemes[IDS.structure] === "horsLigne",
      );
    }
    expect(failuresWithRisk).toBeGreaterThan(failuresWithoutRisk);
  }, 30_000);

  it("uses the documented LRO-like 2,160 Gbit/day contact capacity without saturation", () => {
    const profilLro = schemaProfilOperations.parse(
      JSON.parse(
        readFileSync(new URL("./fixtures/lro-like.json", import.meta.url), "utf8"),
      ) as unknown,
    );
    for (const donneesGbit of [461, 572]) {
      const config = schemaConfigurationFigee.parse({
        ...configuration({
          dataMbps: (donneesGbit * 1000) / profilLro.tempsObservationSParJour,
          tempsObservationSParJour: profilLro.tempsObservationSParJour,
        }),
        profilOperations: profilLro,
      });
      expect(capaciteDescenteGbitJour(config)).toBe(2160);
      const etat = avancer(demarrer(optionsDemarrage(config)).etat, [], 1).etat;
      expect(etat.donneesGenereesGbit).toBeCloseTo(donneesGbit, 8);
      expect(etat.donneesTransmisesGbit).toBeCloseTo(donneesGbit, 8);
      expect(etat.tamponGbit).toBe(0);
      expect(etat.donneesPerduesGbit).toBe(0);
    }
  });

  it("completes a 365-day simulation under the provisional two-second target", () => {
    const config = configuration({
      dureeCibleJours: 365,
      limiteDegradationPanneaux: 365,
      limiteAutonomieCarburant: 365,
      limiteToleranceRadiation: 365,
    });
    const debut = performance.now();
    const etat = avancer(demarrer(optionsDemarrage(config)).etat, [], 365).etat;
    const dureeMs = performance.now() - debut;

    expect(etat.terminee).toBe(true);
    expect(dureeMs).toBeLessThan(2000);
  });

  it("publishes launch and completion events through the application service", () => {
    const evenements: EvenementDomaine[] = [];
    const bus: BusEvenements = {
      publier: (evenement) => evenements.push(evenement),
      souscrire: () => () => undefined,
    };
    const service = new ServiceSimulation(bus);
    const etat = service.demarrer(optionsDemarrage());
    const termine = service.avancer(etat, [], 6);

    expect(service.progression(termine).terminee).toBe(true);
    expect(service.terminer(termine).issue).toBe("nominale");
    expect(evenements.map((event) => event.type)).toEqual(["MissionLancée", "SimulationTerminée"]);
  });
});
