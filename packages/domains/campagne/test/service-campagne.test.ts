import {
  schemaBilanMission,
  schemaConfigurationFigee,
  schemaPaquetScenario,
  schemaRapportMission,
  schemaReferentielCatalogue,
  schemaResultatSimulation,
  type BusEvenements,
  type EvenementDomaine,
  type PortCatalogue,
  type PortConception,
  type PortEvaluation,
  type PortScenarios,
  type PortSimulation,
} from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ServiceCampagne } from "../src/application/service-campagne.js";
import type { DepotCampagne } from "../src/domain/depot.js";
import type {
  EntreeJournal,
  MissionCampagne,
  PageResultat,
  ProgressionScenario,
  ScenarioDisponible,
} from "../src/domain/types.js";

const uuid = (numero: number): string =>
  `${numero.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;

const IDS = {
  utilisateur: uuid(1),
  premierScenario: uuid(2),
  scenarioSuivant: uuid(3),
  configuration: uuid(4),
  catalogue: uuid(5),
  objectif: uuid(6),
  lanceur: uuid(7),
  mission: uuid(8),
};

function paquet(id: string, conditionsDeblocage: unknown[] = []) {
  return schemaPaquetScenario.parse({
    version: "1.0.0",
    id,
    cible: "lune",
    budgetMaxMUSD: 100,
    objectifs: [
      {
        id: IDS.objectif,
        titre: "Objectif principal",
        questionScientifique: "Question",
        role: "principal",
      },
    ],
    catalogueAutorise: [IDS.catalogue],
    actes: Array.from({ length: 7 }, (_, numero) => ({
      id: uuid(20 + numero),
      numero,
      titre: { fr: `Acte ${numero}`, en: `Act ${numero}` },
      type: "briefing",
      description: { fr: "Préparez la mission.", en: "Prepare the mission." },
    })),
    definitionsEvenements: [],
    fins: ["A", "B", "C", "D"].map((code) => ({
      code,
      titre: { fr: `Fin ${code}`, en: `Ending ${code}` },
      regles: [{ type: "missionPerdue", seuil: 1 }],
      conclusion: { fr: "Conclusion.", en: "Conclusion." },
    })),
    conditionsDeblocage,
  });
}

const scenarioPremier = paquet(IDS.premierScenario);
const scenarioSuivant = paquet(IDS.scenarioSuivant, [
  {
    id: uuid(31),
    type: "prerequis",
    scenarioPrerequis: IDS.premierScenario,
  },
  { id: uuid(32), type: "fin", finMinimale: "C" },
  { id: uuid(33), type: "score", scoreMinimal: 500 },
]);

const configuration = schemaConfigurationFigee.parse({
  version: 1,
  configurationId: IDS.configuration,
  scenarioId: IDS.premierScenario,
  versionScenario: "1.0.0",
  versionCatalogue: "1.0.0",
  orbiteur: {
    masseSecheKg: 100,
    carburantKg: 0,
    puissanceProduiteW: 100,
    puissanceConsommeeW: 20,
    capaciteBatterieWh: 300,
    coutMUSD: 50,
    elements: [],
    instruments: [],
  },
  orbite: { type: "polaire", altitudeKm: 100, inclinaisonDeg: 90, fractionEclipse: 0.4 },
  lanceur: { id: IDS.lanceur, capaciteKg: 500, fiabilite: 1 },
  objectifs: { principal: IDS.objectif, secondaires: [] },
  margeDv: 0,
  difficulte: "decouverte",
  bilans: [],
});

const resultat = schemaResultatSimulation.parse({
  version: 1,
  simulationId: uuid(40),
  graine: 123,
  dureeSimuleeJours: 1,
  issue: "nominale",
  serie: [],
  evenements: [],
  decisionsCrise: [],
  sousSystemes: {},
  scienceCumulee: 10,
  scienceMax: 10,
  donneesPerduesGbit: 0,
  donneesGenereesGbit: 0,
  donneesTransmisesGbit: 0,
  carburantRestantKg: 0,
});

function creerBilan(score: number, fin: "A" | "B" | "C" | "D", missionId: string) {
  return schemaBilanMission.parse({
    version: 2,
    missionRef: missionId,
    mode: "solo",
    scoreTotal: score,
    scores: {
      science: (300 * score) / 900,
      technique: (250 * score) / 900,
      ressources: (200 * score) / 900,
      fiabilite: (150 * score) / 900,
      collab: 0,
    },
    fin,
    causes: [],
    decisionsCles: [],
    recommandations: [],
  });
}

class DepotMemoire implements DepotCampagne {
  readonly missions = new Map<string, MissionCampagne>();
  readonly journaux = new Map<string, EntreeJournal[]>();
  readonly progressions = new Map<string, ProgressionScenario>();

  async creerMission(mission: MissionCampagne): Promise<void> {
    this.missions.set(mission.id, mission);
  }

  async lireMission(missionId: string): Promise<MissionCampagne | undefined> {
    return this.missions.get(missionId);
  }

  async listerMissions(
    utilisateurId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<MissionCampagne>> {
    const apresCurseur = [...this.missions.values()]
      .filter(
        (mission) =>
          mission.utilisateurId === utilisateurId &&
          (curseur === undefined || mission.id > curseur),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const page = apresCurseur.slice(0, limite + 1);
    const items = page.slice(0, limite);
    return {
      items,
      nextCursor: page.length > limite ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async enregistrerMission(mission: MissionCampagne): Promise<void> {
    this.missions.set(mission.id, mission);
  }

  async ajouterAuJournal(missionId: string, entree: EntreeJournal): Promise<void> {
    const journal = this.journaux.get(missionId) ?? [];
    journal.push(entree);
    this.journaux.set(missionId, journal);
  }

  async lireJournal(missionId: string): Promise<readonly EntreeJournal[]> {
    return Object.freeze([...(this.journaux.get(missionId) ?? [])]);
  }

  async lirePageJournal(
    missionId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<EntreeJournal>> {
    const journal = this.journaux.get(missionId) ?? [];
    const debut = curseur === undefined ? 0 : Number(curseur);
    const page = journal.slice(debut, debut + limite + 1);
    const items = page.slice(0, limite);
    return {
      items,
      nextCursor: page.length > limite ? String(debut + limite) : null,
    };
  }

  async lireProgressions(utilisateurId: string): Promise<readonly ProgressionScenario[]> {
    return [...this.progressions.values()].filter(
      (progression) => progression.utilisateurId === utilisateurId,
    );
  }

  async enregistrerProgression(progression: ProgressionScenario): Promise<void> {
    this.progressions.set(`${progression.utilisateurId}:${progression.scenarioId}`, progression);
  }
}

function creerService() {
  const appels: string[] = [];
  const depot = new DepotMemoire();
  const paquets = new Map([
    [scenarioPremier.id, scenarioPremier],
    [scenarioSuivant.id, scenarioSuivant],
  ]);
  const versions = new Map([
    [scenarioPremier.id, "1.0.0"],
    [scenarioSuivant.id, "1.0.0"],
  ]);
  const scenarios: PortScenarios = {
    async lister() {
      appels.push("SCE.lister");
      return [
        { id: scenarioPremier.id, version: versions.get(scenarioPremier.id)!, ordre: 1 },
        { id: scenarioSuivant.id, version: versions.get(scenarioSuivant.id)!, ordre: 2 },
      ];
    },
    async lire(id, version) {
      appels.push("SCE.lire");
      return versions.get(id) === version ? paquets.get(id) : undefined;
    },
  };
  const referentiel = schemaReferentielCatalogue.parse({
    version: "1.0.0",
    composants: [],
    instruments: [],
    orbites: [],
    lanceurs: [],
    stationsSol: [],
    seuils: {},
  });
  const catalogue: PortCatalogue = {
    listerVersions: async () => [referentiel.version],
    lire: async (version) => {
      appels.push("CAT.lire");
      return version === referentiel.version ? referentiel : undefined;
    },
    listerIdentifiants: async () => [],
  };
  const conception: PortConception = {
    valider: async () => {
      appels.push("CON.valider");
    },
    figer: async () => {
      appels.push("CON.figer");
      return configuration;
    },
  };
  const simulation: PortSimulation = {
    demarrer: () => {
      appels.push("SIM.demarrer");
      return "etat-0";
    },
    avancer: (etat) => {
      appels.push("SIM.avancer");
      return `${etat}-jour`;
    },
    decider: (etat) => etat,
    terminer: () => {
      appels.push("SIM.terminer");
      return resultat;
    },
    progression: () => ({
      jour: 0,
      dureeCibleJours: 1,
      batterieWh: 0,
      tamponGbit: 0,
      scienceCumulee: 0,
      terminee: false,
    }),
  };
  let score = 700;
  let fin: "A" | "B" | "C" | "D" = "C";
  const evaluation: PortEvaluation = {
    evaluer: (entree) => {
      appels.push("EVA.evaluer");
      return creerBilan(score, fin, entree.missionId);
    },
    genererRapport: (entree, bilan) => {
      appels.push("EVA.rapport");
      return schemaRapportMission.parse({
        version: 1,
        bilan: bilan ?? creerBilan(score, fin, entree.missionId),
        configuration: entree.configuration,
        resultat: entree.resultat,
        chronologie: [],
        leconsApprises: [],
        rejouer: false,
      });
    },
    exporterRapportJson: (rapport) => JSON.stringify(rapport),
  };
  const evenements: EvenementDomaine[] = [];
  const bus: BusEvenements = {
    publier: (evenement) => evenements.push(evenement),
    souscrire: () => () => undefined,
  };
  const service = new ServiceCampagne(
    depot,
    scenarios,
    catalogue,
    conception,
    simulation,
    evaluation,
    bus,
  );
  return {
    service,
    depot,
    appels,
    evenements,
    definirBilan: (prochainScore: number, prochaineFin: "A" | "B" | "C" | "D") => {
      score = prochainScore;
      fin = prochaineFin;
    },
    rendreAncienneVersionIndisponible: () => {
      versions.set(scenarioPremier.id, "2.0.0");
      paquets.set(scenarioPremier.id, paquet(scenarioPremier.id));
    },
  };
}

describe("CAM — machine à états, sauvegarde et progression", () => {
  it("rend le premier scénario disponible et les suivants verrouillés avec leur code", async () => {
    const { service } = creerService();
    const scenarios = await service.listerScenarios(IDS.utilisateur);

    expect(scenarios.find((scenario) => scenario.scenarioId === IDS.premierScenario)?.statut).toBe(
      "disponible",
    );
    const scenarioSuivant = scenarios.find(
      (scenario) => scenario.scenarioId === IDS.scenarioSuivant,
    );
    expect(scenarioSuivant?.statut).toBe("verrouille");
    expect(scenarioSuivant?.conditionsRestantes.length).toBeGreaterThan(0);
    expect(
      scenarioSuivant?.conditionsRestantes.every(
        (condition) => condition.code === "SCENARIO_VERROUILLE",
      ),
    ).toBe(true);
  });

  it("refuse les sauts d'acte et conserve l'accès propriétaire", async () => {
    const { service } = creerService();
    const mission = await service.creerMission({
      missionId: IDS.mission,
      utilisateurId: IDS.utilisateur,
      scenarioId: IDS.premierScenario,
      versionScenario: "1.0.0",
      versionCatalogue: "1.0.0",
      configurationId: IDS.configuration,
      graine: 123,
    });

    await expect(service.avancerActe(IDS.utilisateur, mission.id, 2)).rejects.toMatchObject({
      explication: { code: "ACTE_INVALIDE" },
    });
    await expect(service.lireMission(uuid(99), mission.id)).rejects.toMatchObject({ statut: 404 });
  });

  it("orchestre SCE, CON, SIM, EVA puis stocke le bilan avant progression et déblocage", async () => {
    const { service, depot, appels, evenements } = creerService();
    const mission = await service.creerMission({
      missionId: IDS.mission,
      utilisateurId: IDS.utilisateur,
      scenarioId: IDS.premierScenario,
      versionScenario: "1.0.0",
      versionCatalogue: "1.0.0",
      configurationId: IDS.configuration,
      graine: 123,
    });
    await service.avancerActe(IDS.utilisateur, mission.id, 1);
    await service.avancerActe(IDS.utilisateur, mission.id, 2);

    appels.length = 0;
    await service.avancerActe(IDS.utilisateur, mission.id, 3);
    expect(appels).toEqual(["SCE.lire", "CON.valider", "CON.figer", "CAT.lire", "SIM.demarrer"]);

    await service.avancerActe(IDS.utilisateur, mission.id, 4);
    await service.avancerSimulation(
      IDS.utilisateur,
      mission.id,
      [{ type: "programmer-transmission", jour: 1, active: true }],
      1,
    );
    await service.avancerActe(IDS.utilisateur, mission.id, 5);
    const terminee = await service.avancerActe(IDS.utilisateur, mission.id, 6);

    expect(terminee.bilan?.scoreTotal).toBe(700);
    expect(depot.missions.get(mission.id)?.bilan?.scoreTotal).toBe(700);
    expect(
      (await service.listerScenarios(IDS.utilisateur)).find(
        (scenario) => scenario.scenarioId === IDS.scenarioSuivant,
      )?.statut,
    ).toBe("disponible");
    expect(evenements.some((evenement) => evenement.type === "ScénarioDébloqué")).toBe(true);

    const journal = depot.journaux.get(mission.id) ?? [];
    const bilanIndex = journal.findIndex((entree) => entree.libelle === "BILAN_STOCKE");
    const progressionIndex = journal.findIndex(
      (entree) => entree.libelle === "PROGRESSION_MISE_A_JOUR",
    );
    const deblocageIndex = journal.findIndex((entree) => entree.libelle === "SCENARIO_DEBLOQUE");
    expect(bilanIndex).toBeGreaterThanOrEqual(0);
    expect(progressionIndex).toBeGreaterThan(bilanIndex);
    expect(deblocageIndex).toBeGreaterThan(progressionIndex);
    expect(journal.every((entree) => Number.isFinite(Date.parse(entree.date)))).toBe(true);
    expect(
      journal.some(
        (entree) =>
          entree.libelle === "DECISION_CONSIGNEE" && entree.effets[0]?.params["active"] === "true",
      ),
    ).toBe(true);
  });

  it("garde le meilleur score et la disponibilité après une tentative moins bonne", async () => {
    const { service, depot, definirBilan } = creerService();
    const terminerUneMission = async (missionId: string) => {
      await service.creerMission({
        missionId,
        utilisateurId: IDS.utilisateur,
        scenarioId: IDS.premierScenario,
        versionScenario: "1.0.0",
        versionCatalogue: "1.0.0",
        configurationId: IDS.configuration,
        graine: 123,
      });
      for (let acte = 1; acte <= 6; acte += 1) {
        await service.avancerActe(IDS.utilisateur, missionId, acte);
      }
    };
    await terminerUneMission(IDS.mission);
    definirBilan(100, "D");
    await terminerUneMission(uuid(90));

    const progression = depot.progressions.get(`${IDS.utilisateur}:${IDS.premierScenario}`);
    expect(progression).toMatchObject({
      disponible: true,
      termine: true,
      tentatives: 2,
      meilleurScore: 700,
      meilleureFin: "C",
    });
  });

  it("reprend la version épinglée et exige un rejeu si cette version manque", async () => {
    const fixture = creerService();
    const mission = await fixture.service.creerMission({
      missionId: IDS.mission,
      utilisateurId: IDS.utilisateur,
      scenarioId: IDS.premierScenario,
      versionScenario: "1.0.0",
      versionCatalogue: "1.0.0",
      configurationId: IDS.configuration,
      graine: 123,
    });
    await fixture.service.reprendre(IDS.utilisateur, mission.id);
    fixture.rendreAncienneVersionIndisponible();
    await expect(fixture.service.reprendre(IDS.utilisateur, mission.id)).rejects.toMatchObject({
      statut: 409,
      explication: { code: "VERSION_EPINGLEE_INDISPONIBLE", params: { rejouer: "true" } },
    });
  });

  it("n'ouvre le scénario suivant que si toutes les conditions de fin et de score sont satisfaites", async () => {
    const terminer = async (
      score: number,
      fin: "A" | "B" | "C" | "D",
    ): Promise<readonly ScenarioDisponible[]> => {
      const fixture = creerService();
      fixture.definirBilan(score, fin);
      const mission = await fixture.service.creerMission({
        missionId: IDS.mission,
        utilisateurId: IDS.utilisateur,
        scenarioId: IDS.premierScenario,
        versionScenario: "1.0.0",
        versionCatalogue: "1.0.0",
        configurationId: IDS.configuration,
        graine: 123,
      });
      for (let acte = 1; acte <= 6; acte += 1) {
        await fixture.service.avancerActe(IDS.utilisateur, mission.id, acte);
      }
      return fixture.service.listerScenarios(IDS.utilisateur);
    };

    const finD = await terminer(700, "D");
    const scenarioFinD = finD.find((scenario) => scenario.scenarioId === IDS.scenarioSuivant);
    expect(scenarioFinD?.statut).toBe("verrouille");
    expect(scenarioFinD?.conditionsRestantes).toHaveLength(1);

    const finB = await terminer(700, "B");
    expect(finB.find((scenario) => scenario.scenarioId === IDS.scenarioSuivant)?.statut).toBe(
      "disponible",
    );

    const finC = await terminer(700, "C");
    expect(finC.find((scenario) => scenario.scenarioId === IDS.scenarioSuivant)?.statut).toBe(
      "disponible",
    );

    const scoreInsuffisant = await terminer(400, "C");
    const scenarioScoreInsuffisant = scoreInsuffisant.find(
      (scenario) => scenario.scenarioId === IDS.scenarioSuivant,
    );
    expect(scenarioScoreInsuffisant?.statut).toBe("verrouille");
    expect(scenarioScoreInsuffisant?.conditionsRestantes).toHaveLength(1);
  });

  it("produit le même bilan après une sauvegarde et une reprise à l'acte IV", async () => {
    const terminer = async (reprendre: boolean) => {
      const { service } = creerService();
      const mission = await service.creerMission({
        missionId: IDS.mission,
        utilisateurId: IDS.utilisateur,
        scenarioId: IDS.premierScenario,
        versionScenario: "1.0.0",
        versionCatalogue: "1.0.0",
        configurationId: IDS.configuration,
        graine: 123,
      });
      for (let acte = 1; acte <= 4; acte += 1) {
        await service.avancerActe(IDS.utilisateur, mission.id, acte);
      }
      if (reprendre) {
        const sauvegarde = await service.reprendre(IDS.utilisateur, mission.id);
        expect(sauvegarde.acte).toBe(4);
        expect(sauvegarde.graine).toBe(123);
        expect(sauvegarde.versionScenario).toBe("1.0.0");
        expect(sauvegarde.versionCatalogue).toBe("1.0.0");
      }
      await service.avancerSimulation(
        IDS.utilisateur,
        mission.id,
        [{ type: "programmer-transmission", jour: 1, active: true }],
        1,
      );
      await service.avancerActe(IDS.utilisateur, mission.id, 5);
      return service.avancerActe(IDS.utilisateur, mission.id, 6);
    };
    const sansInterruption = await terminer(false);
    const avecReprise = await terminer(true);
    expect(avecReprise.bilan).toEqual(sansInterruption.bilan);
  });
});
