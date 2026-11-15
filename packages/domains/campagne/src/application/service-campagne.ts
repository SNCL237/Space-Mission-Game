import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  CATALOGUE_PORT,
  CODES_CAMPAGNE,
  CONCEPTION_PORT,
  EVALUATION_PORT,
  EVENT_BUS,
  SCENARIOS_PORT,
  SIMULATION_PORT,
  schemaConceptionValidee,
  schemaMissionCreee,
  schemaScenarioDebloque,
  type BilanMission,
  type BusEvenements,
  type CodeExplication,
  type CommandeSimulation,
  type ConfigurationFigee,
  type EntreeEvaluation,
  type PaquetScenario,
  type PortCatalogue,
  type PortConception,
  type PortEvaluation,
  type PortScenarios,
  type PortSimulation,
} from "@smdg/contracts";

import { DEPOT_CAMPAGNE, type DepotCampagne } from "../domain/depot.js";
import { ErreurCampagne } from "../domain/erreur-campagne.js";
import { profilOperationsServeur } from "../domain/profil-operations.js";
import type {
  ActeCampagne,
  EntreeCreationMission,
  EntreeJournal,
  MissionCampagne,
  PageResultat,
  ProgressionScenario,
  ResultatDeblocage,
  ScenarioDisponible,
} from "../domain/types.js";

const RANG_FIN = { D: 0, C: 1, B: 2, A: 3 } as const;

function expliquer(code: string, params: Record<string, number | string> = {}): CodeExplication {
  return { version: 1, code, params };
}

function effetsCommande(commande: CommandeSimulation): CodeExplication[] {
  const communs = { type: commande.type, jour: commande.jour };
  if (commande.type === "planifier-observation") {
    return [
      expliquer(CODES_CAMPAGNE.DECISION_CONSIGNEE, {
        ...communs,
        instrumentId: commande.instrumentId,
        active: String(commande.active),
      }),
    ];
  }
  if (commande.type === "programmer-transmission") {
    return [
      expliquer(CODES_CAMPAGNE.DECISION_CONSIGNEE, {
        ...communs,
        active: String(commande.active),
      }),
    ];
  }
  return [
    expliquer(CODES_CAMPAGNE.DECISION_CONSIGNEE, {
      ...communs,
      deltaVms: commande.deltaVms,
    }),
  ];
}

function meilleureFin(
  precedente: ProgressionScenario["meilleureFin"],
  nouvelle: BilanMission["fin"],
): BilanMission["fin"] {
  if (precedente === null || RANG_FIN[nouvelle] > RANG_FIN[precedente]) return nouvelle;
  return precedente;
}

function choisirVersion<T extends { version: string }>(versions: readonly T[]): T | undefined {
  return [...versions].sort((a, b) =>
    b.version.localeCompare(a.version, "en", { numeric: true, sensitivity: "base" }),
  )[0];
}

@Injectable()
export class ServiceCampagne {
  constructor(
    @Inject(DEPOT_CAMPAGNE) private readonly depot: DepotCampagne,
    @Inject(SCENARIOS_PORT) private readonly scenarios: PortScenarios,
    @Inject(CATALOGUE_PORT) private readonly catalogue: PortCatalogue,
    @Inject(CONCEPTION_PORT) private readonly conception: PortConception,
    @Inject(SIMULATION_PORT) private readonly simulation: PortSimulation,
    @Inject(EVALUATION_PORT) private readonly evaluation: PortEvaluation,
    @Inject(EVENT_BUS) private readonly bus: BusEvenements,
  ) {}

  async listerScenarios(utilisateurId: string): Promise<readonly ScenarioDisponible[]> {
    const disponibles = await this.scenarios.lister();
    const progressions = await this.depot.lireProgressions(utilisateurId);
    const premiere = [...disponibles].sort((a, b) => a.ordre - b.ordre)[0];
    const choixVersions = new Map<string, { version: string; ordre: number }>();
    for (const candidat of disponibles) {
      const existant = choixVersions.get(candidat.id);
      if (
        existant === undefined ||
        choisirVersion([{ version: candidat.version }, { version: existant.version }])?.version ===
          candidat.version
      ) {
        choixVersions.set(candidat.id, { version: candidat.version, ordre: candidat.ordre });
      }
    }

    const resultats = await Promise.all(
      [...choixVersions.entries()].map(async ([scenarioId, choix]) => {
        const progression = this.progresser(progressions, utilisateurId, scenarioId);
        const paquet = await this.scenarios.lire(scenarioId, choix.version);
        if (paquet === undefined) {
          throw new ErreurCampagne(
            expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
              scenario: scenarioId,
              version: choix.version,
            }),
            409,
          );
        }
        const conditionsRestantes = this.conditionsRestantes(paquet, progressions);
        const estPremier = premiere?.id === scenarioId;
        const disponible =
          estPremier ||
          progression.disponible ||
          (paquet.conditionsDeblocage.length > 0 && conditionsRestantes.length === 0);
        return {
          scenarioId,
          version: choix.version,
          ordre: choix.ordre,
          statut: progression.termine ? "termine" : disponible ? "disponible" : "verrouille",
          conditionsRestantes: disponible ? [] : conditionsRestantes,
          progression: { ...progression, disponible },
        } satisfies ScenarioDisponible;
      }),
    );
    return resultats.sort((a, b) => a.ordre - b.ordre || a.scenarioId.localeCompare(b.scenarioId));
  }

  async creerMission(entree: EntreeCreationMission): Promise<MissionCampagne> {
    if ((await this.catalogue.lire(entree.versionCatalogue)) === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          versionCatalogue: entree.versionCatalogue,
          rejouer: "true",
        }),
        409,
      );
    }
    const scenarios = await this.scenarios.lister();
    const choix = scenarios.find(
      (scenario) =>
        scenario.id === entree.scenarioId && scenario.version === entree.versionScenario,
    );
    if (choix === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          scenario: entree.scenarioId,
          version: entree.versionScenario,
        }),
        409,
      );
    }
    const statut = (await this.listerScenarios(entree.utilisateurId)).find(
      (scenario) => scenario.scenarioId === entree.scenarioId,
    );
    if (statut?.statut === "verrouille" || statut === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.SCENARIO_VERROUILLE, { scenario: entree.scenarioId }),
        403,
      );
    }
    const scenario = await this.scenarios.lire(entree.scenarioId, entree.versionScenario);
    if (scenario === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          scenario: entree.scenarioId,
          version: entree.versionScenario,
        }),
        409,
      );
    }
    const mission: MissionCampagne = {
      id: entree.missionId,
      utilisateurId: entree.utilisateurId,
      scenarioId: entree.scenarioId,
      versionScenario: entree.versionScenario,
      versionCatalogue: entree.versionCatalogue,
      graine: entree.graine,
      acte: 0,
      configurationId: entree.configurationId,
      scenario,
      configuration: null,
      etatSimulation: null,
      resultat: null,
      bilan: null,
      rapportJson: null,
      terminee: false,
    };
    await this.depot.creerMission(mission);
    await this.ajouterJournal(mission, "MISSION_CREEE");
    this.bus.publier(
      schemaMissionCreee.parse({
        type: "MissionCréée",
        version: 1,
        missionId: mission.id,
        scenarioId: mission.scenarioId,
        versionScenario: mission.versionScenario,
        utilisateurId: mission.utilisateurId,
      }),
    );
    return mission;
  }

  async lireMission(
    utilisateurId: string,
    missionId: string,
  ): Promise<
    MissionCampagne & {
      journal: readonly EntreeJournal[];
    }
  > {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    return { ...mission, journal: await this.depot.lireJournal(missionId) };
  }

  async listerMissions(
    utilisateurId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<MissionCampagne>> {
    return this.depot.listerMissions(utilisateurId, limite, curseur);
  }

  async lirePageJournal(
    utilisateurId: string,
    missionId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<EntreeJournal>> {
    await this.obtenirMission(utilisateurId, missionId);
    return this.depot.lirePageJournal(missionId, limite, curseur);
  }

  async reprendre(
    utilisateurId: string,
    missionId: string,
  ): Promise<
    MissionCampagne & {
      journal: readonly EntreeJournal[];
    }
  > {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    const scenario = await this.scenarios.lire(mission.scenarioId, mission.versionScenario);
    const referentiel = await this.catalogue.lire(mission.versionCatalogue);
    if (scenario === undefined || referentiel === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          scenario: mission.scenarioId,
          versionScenario: mission.versionScenario,
          versionCatalogue: mission.versionCatalogue,
          rejouer: "true",
        }),
        409,
      );
    }
    return { ...mission, journal: await this.depot.lireJournal(missionId) };
  }

  async avancerActe(
    utilisateurId: string,
    missionId: string,
    acteSuivant: number,
  ): Promise<MissionCampagne> {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    if (mission.terminee) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_DEJA_TERMINEE), 409);
    }
    if (!Number.isInteger(acteSuivant) || acteSuivant !== mission.acte + 1 || acteSuivant > 6) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.ACTE_INVALIDE, {
          acteActuel: mission.acte,
          acteDemande: Number.isFinite(acteSuivant) ? acteSuivant : "invalide",
        }),
      );
    }

    let suite = { ...mission, acte: acteSuivant as ActeCampagne };
    if (acteSuivant === 3) suite = await this.lancerSimulation(suite);
    await this.ajouterJournal(suite, `ACTE_${acteSuivant}`);
    await this.depot.enregistrerMission(suite);
    if (acteSuivant === 6) return this.cloturer(utilisateurId, missionId);
    return suite;
  }

  async avancerSimulation(
    utilisateurId: string,
    missionId: string,
    commandes: Parameters<PortSimulation["avancer"]>[1],
    jours: number,
  ): Promise<MissionCampagne> {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    this.exigerActeOperation(mission);
    if (mission.etatSimulation === null) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_NON_PRETE), 409);
    }
    for (const commande of commandes) {
      await this.ajouterJournal(
        mission,
        CODES_CAMPAGNE.DECISION_CONSIGNEE,
        effetsCommande(commande),
      );
    }
    const suite = {
      ...mission,
      etatSimulation: this.simulation.avancer(mission.etatSimulation, commandes, jours),
    };
    if (commandes.length === 0) await this.ajouterJournal(suite, "SIMULATION_AVANCEE");
    await this.depot.enregistrerMission(suite);
    return suite;
  }

  async deciderCrise(
    utilisateurId: string,
    missionId: string,
    choix: Parameters<PortSimulation["decider"]>[1],
    cibleId?: string,
  ): Promise<MissionCampagne> {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    this.exigerActeOperation(mission);
    if (mission.etatSimulation === null) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_NON_PRETE), 409);
    }
    const suite = {
      ...mission,
      etatSimulation: this.simulation.decider(mission.etatSimulation, choix, cibleId),
    };
    await this.ajouterJournal(suite, CODES_CAMPAGNE.DECISION_CONSIGNEE, [
      expliquer(CODES_CAMPAGNE.DECISION_CONSIGNEE, {
        choix,
        ...(cibleId !== undefined ? { cibleId } : {}),
      }),
    ]);
    await this.depot.enregistrerMission(suite);
    return suite;
  }

  async cloturer(utilisateurId: string, missionId: string): Promise<MissionCampagne> {
    const mission = await this.obtenirMission(utilisateurId, missionId);
    if (mission.bilan !== null) return mission;
    if (mission.acte !== 6) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_NON_TERMINEE), 409);
    }
    if (mission.configuration === null || mission.etatSimulation === null) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_NON_PRETE), 409);
    }

    const resultat = this.simulation.terminer(mission.etatSimulation);
    const entree: EntreeEvaluation = {
      missionId: mission.id,
      mode: "solo",
      scenario: mission.scenario,
      configuration: mission.configuration,
      resultat,
    };
    const bilan = this.evaluation.evaluer(entree);
    const rapport = this.evaluation.genererRapport(entree, bilan);
    const terminee: MissionCampagne = {
      ...mission,
      resultat,
      bilan,
      rapportJson: this.evaluation.exporterRapportJson(rapport),
      terminee: true,
    };
    await this.ajouterJournal(terminee, "BILAN_STOCKE");
    await this.depot.enregistrerMission(terminee);

    await this.enregistrerProgression(terminee, bilan);
    await this.ajouterJournal(terminee, CODES_CAMPAGNE.PROGRESSION_MISE_A_JOUR, [
      expliquer(CODES_CAMPAGNE.PROGRESSION_MISE_A_JOUR, { score: bilan.scoreTotal }),
    ]);
    const resultats = await this.evaluerDeblocages(utilisateurId);
    for (const scenarioId of resultats.debloques) {
      await this.ajouterJournal(terminee, CODES_CAMPAGNE.SCENARIO_DEBLOQUE, [
        expliquer(CODES_CAMPAGNE.SCENARIO_DEBLOQUE, { scenario: scenarioId }),
      ]);
    }
    await this.depot.enregistrerMission(terminee);
    return terminee;
  }

  private async lancerSimulation(mission: MissionCampagne): Promise<MissionCampagne> {
    const scenario = await this.scenarios.lire(mission.scenarioId, mission.versionScenario);
    if (scenario === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          scenario: mission.scenarioId,
          version: mission.versionScenario,
        }),
        409,
      );
    }
    await this.conception.valider(mission.configurationId);
    const configuration = await this.conception.figer(mission.configurationId);
    if (
      configuration.scenarioId !== mission.scenarioId ||
      configuration.versionScenario !== mission.versionScenario ||
      configuration.versionCatalogue !== mission.versionCatalogue
    ) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.CONCEPTION_INCONNUE), 409);
    }
    const catalogue = await this.catalogue.lire(configuration.versionCatalogue);
    if (catalogue === undefined) {
      throw new ErreurCampagne(
        expliquer(CODES_CAMPAGNE.VERSION_EPINGLEE_INDISPONIBLE, {
          versionCatalogue: configuration.versionCatalogue,
          rejouer: "true",
        }),
        409,
      );
    }
    // B2 : le serveur fixe le profil d'opérations ; la valeur éventuelle du client est ignorée.
    const configurationValidee = {
      ...configuration,
      profilOperations: profilOperationsServeur(configuration, catalogue),
    } satisfies ConfigurationFigee;
    const resultat = {
      ...mission,
      scenario,
      configuration: configurationValidee,
      versionCatalogue: configuration.versionCatalogue,
      etatSimulation: this.simulation.demarrer({
        missionId: mission.id,
        simulationId: randomUUID(),
        graine: mission.graine,
        configuration: configurationValidee,
        definitionsEvenements: scenario.definitionsEvenements,
      }),
    };
    this.bus.publier(
      schemaConceptionValidee.parse({
        type: "ConceptionValidée",
        version: 1,
        missionId: mission.id,
        configurationId: configuration.configurationId,
        versionConfiguration: configuration.version,
      }),
    );
    return resultat;
  }

  private async enregistrerProgression(
    mission: MissionCampagne,
    bilan: BilanMission,
  ): Promise<ProgressionScenario> {
    const progressions = await this.depot.lireProgressions(mission.utilisateurId);
    const precedente = progressions.find((item) => item.scenarioId === mission.scenarioId);
    const progression: ProgressionScenario = {
      utilisateurId: mission.utilisateurId,
      scenarioId: mission.scenarioId,
      disponible: true,
      termine: true,
      tentatives: (precedente?.tentatives ?? 0) + 1,
      meilleurScore: Math.max(precedente?.meilleurScore ?? 0, bilan.scoreTotal),
      meilleureFin: meilleureFin(precedente?.meilleureFin ?? null, bilan.fin),
    };
    await this.depot.enregistrerProgression(progression);
    return progression;
  }

  private async evaluerDeblocages(utilisateurId: string): Promise<ResultatDeblocage> {
    const progressions = [...(await this.depot.lireProgressions(utilisateurId))];
    const scenarios = await this.listerScenarios(utilisateurId);
    const ordreInitial = Math.min(...scenarios.map((scenario) => scenario.ordre));
    const debloques: string[] = [];
    for (const scenario of scenarios) {
      const progressionEnregistree = progressions.find(
        (progression) => progression.scenarioId === scenario.scenarioId,
      );
      if (
        scenario.ordre === ordreInitial ||
        progressionEnregistree?.disponible === true ||
        scenario.conditionsRestantes.length > 0 ||
        progressionEnregistree?.termine === true
      ) {
        continue;
      }
      const paquet = await this.scenarios.lire(scenario.scenarioId, scenario.version);
      if (paquet === undefined || paquet.conditionsDeblocage.length === 0) continue;
      const progression = {
        ...this.progresser(progressions, utilisateurId, scenario.scenarioId),
        disponible: true,
      };
      await this.depot.enregistrerProgression(progression);
      progressions.push(progression);
      debloques.push(scenario.scenarioId);
      this.bus.publier(
        schemaScenarioDebloque.parse({
          type: "ScénarioDébloqué",
          version: 1,
          scenarioId: scenario.scenarioId,
          utilisateurId,
        }),
      );
    }
    return { progression: progressions, debloques };
  }

  private conditionsRestantes(
    scenario: PaquetScenario,
    progressions: readonly ProgressionScenario[],
  ): CodeExplication[] {
    const prerequisId = scenario.conditionsDeblocage.find(
      (condition) => condition.type === "prerequis",
    )?.scenarioPrerequis;
    const progressionsReferences = progressions.filter(
      (progression) =>
        progression.termine &&
        (prerequisId === undefined || progression.scenarioId === prerequisId),
    );
    return scenario.conditionsDeblocage
      .filter((condition) => {
        if (condition.type === "prerequis") {
          return (
            condition.scenarioPrerequis === undefined ||
            !progressions.some(
              (progression) =>
                progression.scenarioId === condition.scenarioPrerequis && progression.termine,
            )
          );
        }
        if (condition.type === "fin") {
          const finMinimale = condition.finMinimale;
          if (finMinimale === undefined) return true;
          return !progressionsReferences.some(
            (progression) =>
              progression.meilleureFin !== null &&
              RANG_FIN[progression.meilleureFin] >= RANG_FIN[finMinimale],
          );
        }
        const scoreMinimal = condition.scoreMinimal;
        if (scoreMinimal === undefined) return true;
        return !progressionsReferences.some(
          (progression) =>
            progression.meilleurScore !== null && progression.meilleurScore >= scoreMinimal,
        );
      })
      .map((condition) =>
        expliquer(CODES_CAMPAGNE.SCENARIO_VERROUILLE, {
          condition: condition.id,
          scenario: condition.scenarioPrerequis ?? scenario.id,
        }),
      );
  }

  private progresser(
    progressions: readonly ProgressionScenario[],
    utilisateurId: string,
    scenarioId: string,
  ): ProgressionScenario {
    return (
      progressions.find((progression) => progression.scenarioId === scenarioId) ?? {
        utilisateurId,
        scenarioId,
        disponible: false,
        termine: false,
        tentatives: 0,
        meilleurScore: null,
        meilleureFin: null,
      }
    );
  }

  private async obtenirMission(utilisateurId: string, missionId: string): Promise<MissionCampagne> {
    const mission = await this.depot.lireMission(missionId);
    if (mission === undefined || mission.utilisateurId !== utilisateurId) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_INCONNUE), 404);
    }
    return mission;
  }

  private exigerActeOperation(mission: MissionCampagne): void {
    if (mission.acte !== 4 && mission.acte !== 5) {
      throw new ErreurCampagne(expliquer(CODES_CAMPAGNE.MISSION_NON_PRETE), 409);
    }
  }

  private async ajouterJournal(
    mission: MissionCampagne,
    libelle: string,
    effets: readonly CodeExplication[] = [],
  ): Promise<void> {
    const entree: EntreeJournal = {
      id: randomUUID(),
      acte: mission.acte,
      libelle,
      effets,
      date: new Date().toISOString(),
    };
    await this.depot.ajouterAuJournal(mission.id, entree);
  }
}
