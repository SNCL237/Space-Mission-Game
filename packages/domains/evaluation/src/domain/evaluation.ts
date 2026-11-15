import {
  CODES_EVALUATION,
  schemaBilanMission,
  schemaConfigurationFigee,
  schemaId,
  schemaPaquetScenario,
  schemaResultatSimulation,
  type BilanMission,
  type CodeExplication,
  type EntreeEvaluation,
  type PaquetScenario,
  type ResultatSimulation,
} from "@smdg/contracts";

import { ErreurEvaluation } from "./erreur-evaluation.js";
import { schemaRapportMission, type RapportMission } from "./rapport.js";

const SCORE_SCIENCE = 300;
const SCORE_TECHNIQUE = 250;
const SCORE_RESSOURCES = 200;
const SCORE_FIABILITE = 150;
const SCORE_COLLABORATION = 100;
const PLAFOND_SANS_COLLABORATION =
  SCORE_SCIENCE + SCORE_TECHNIQUE + SCORE_RESSOURCES + SCORE_FIABILITE;

interface MesuresEvaluation {
  readonly science: number;
  readonly sciencesAtteintes: number;
  readonly moyenneDisponibilite: number;
  readonly moyenneMarges: number;
  readonly technique: number;
  readonly ratioBudgetUtilise: number;
  readonly ratioDonneesPerdues: number;
  readonly ressources: number;
  readonly fiabilite: number;
  readonly penaliteRisque: number;
  readonly scoreTotal: number;
}

function borner(valeur: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, valeur));
}

function moyenne(valeurs: readonly number[]): number {
  return valeurs.length === 0
    ? 0
    : valeurs.reduce((total, valeur) => total + valeur, 0) / valeurs.length;
}

function exiger(
  condition: boolean,
  code: string,
  params: Record<string, number | string> = {},
): void {
  if (!condition) throw new ErreurEvaluation(code, params);
}

function validerEntree(entree: EntreeEvaluation): EntreeEvaluation {
  const scenario = schemaPaquetScenario.safeParse(entree.scenario);
  const configuration = schemaConfigurationFigee.safeParse(entree.configuration);
  const resultat = schemaResultatSimulation.safeParse(entree.resultat);
  if (!scenario.success || !configuration.success || !resultat.success) {
    throw new ErreurEvaluation("ENTREE_EVALUATION_INVALIDE", {
      champs: [
        ...(!scenario.success ? ["scenario"] : []),
        ...(!configuration.success ? ["configuration"] : []),
        ...(!resultat.success ? ["resultat"] : []),
      ].join(","),
    });
  }
  exiger(schemaId.safeParse(entree.missionId).success, "MISSION_REF_INVALIDE");
  exiger(
    entree.configuration.scenarioId === entree.scenario.id,
    "SCENARIO_CONFIGURATION_INCOHERENT",
  );
  exiger(
    entree.configuration.objectifs.principal ===
      entree.scenario.objectifs.find((objectif) => objectif.role === "principal")?.id,
    "OBJECTIF_PRINCIPAL_INCOHERENT",
  );
  if (entree.resultat.progressionScientifiqueParObjectif === undefined) {
    throw new ErreurEvaluation("PROGRESSION_SCIENCE_ABSENTE");
  }
  if (entree.resultat.donneesGenereesGbit === undefined) {
    throw new ErreurEvaluation("MESURES_DONNEES_ABSENTES");
  }
  if (entree.configuration.profilOperations === undefined) {
    throw new ErreurEvaluation("PROFIL_OPERATIONS_REQUIS");
  }

  const objectifsAutorises = new Set(entree.scenario.objectifs.map((objectif) => objectif.id));
  const objectifsSelectionnes = new Set([
    entree.configuration.objectifs.principal,
    ...entree.configuration.objectifs.secondaires,
  ]);
  if (
    objectifsSelectionnes.size !== entree.configuration.objectifs.secondaires.length + 1 ||
    [...objectifsSelectionnes].some((objectif) => !objectifsAutorises.has(objectif))
  ) {
    throw new ErreurEvaluation("OBJECTIFS_CONFIGURATION_INVALIDES");
  }
  for (const instrument of entree.configuration.orbiteur.instruments) {
    if (instrument.objectifs === undefined || instrument.objectifs.length === 0) {
      throw new ErreurEvaluation("OBJECTIFS_INSTRUMENT_REQUIS", {
        instrument: instrument.idCatalogue,
      });
    }
    if (
      new Set(instrument.objectifs).size !== instrument.objectifs.length ||
      !instrument.objectifs.every((objectif) => objectifsSelectionnes.has(objectif))
    ) {
      throw new ErreurEvaluation("OBJECTIF_INSTRUMENT_INVALIDE", {
        instrument: instrument.idCatalogue,
      });
    }
  }
  if (entree.mode === "equipe") {
    const collaboration = entree.collaboration;
    if (collaboration === undefined) throw new ErreurEvaluation("MESURES_COLLABORATION_REQUISES");
    if (
      collaboration.tauxParticipation < 0 ||
      collaboration.tauxParticipation > 1 ||
      collaboration.conflits < 0 ||
      collaboration.conflits > 1
    ) {
      throw new ErreurEvaluation("MESURES_COLLABORATION_INVALIDES");
    }
  }
  return entree;
}

function lireProgression(resultat: ResultatSimulation, objectif: string): number {
  const progression = resultat.progressionScientifiqueParObjectif?.[objectif];
  if (progression === undefined || progression.maximum <= 0) return 0;
  return borner(progression.cumulee / progression.maximum);
}

function progressionPonderee(entree: EntreeEvaluation): {
  readonly score: number;
  readonly nombreAtteints: number;
} {
  const objectifs = [
    entree.configuration.objectifs.principal,
    ...entree.configuration.objectifs.secondaires,
  ];
  const progression = new Map(
    objectifs.map((objectif) => [objectif, lireProgression(entree.resultat, objectif)]),
  );
  const principale = progression.get(entree.configuration.objectifs.principal) ?? 0;
  const secondaires = entree.configuration.objectifs.secondaires.map(
    (objectif) => progression.get(objectif) ?? 0,
  );
  const score =
    SCORE_SCIENCE *
    (secondaires.length === 0 ? principale : 0.6 * principale + 0.4 * moyenne(secondaires));
  const nombreAtteints = objectifs.filter((objectif) => {
    const mesure = entree.resultat.progressionScientifiqueParObjectif?.[objectif];
    return mesure !== undefined && mesure.maximum > 0 && mesure.cumulee >= mesure.maximum;
  }).length;
  return { score, nombreAtteints };
}

function calculerFiabilite(entree: EntreeEvaluation): number {
  if (entree.resultat.issue === "perdue") return 0;
  const configuration = entree.configuration;
  const mtbf = configuration.profilOperations?.mtbfJoursParSysteme;
  if (mtbf === undefined) throw new ErreurEvaluation("PROFIL_OPERATIONS_REQUIS");
  const ids = [
    ...configuration.orbiteur.elements.map((element) => element.idCatalogue),
    ...configuration.orbiteur.instruments.map((instrument) => instrument.idCatalogue),
  ];
  let fiabilite = 1;
  for (const id of ids) {
    const dureeMoyenne = mtbf[id];
    if (dureeMoyenne === undefined || dureeMoyenne <= 0) {
      throw new ErreurEvaluation("MTBF_SYSTEME_ABSENT", { systeme: id });
    }
    fiabilite *= Math.exp(-entree.resultat.dureeSimuleeJours / dureeMoyenne);
  }
  return borner(fiabilite);
}

function obtenirMesures(entree: EntreeEvaluation): MesuresEvaluation {
  const progression = progressionPonderee(entree);
  const points = entree.resultat.serie;
  exiger(
    points.every((point) => point.disponibilite !== undefined && point.marges !== undefined),
    "MESURES_TECHNIQUES_ABSENTES",
  );
  const disponibilite = moyenne(points.map((point) => point.disponibilite ?? 0));
  const marges = moyenne(
    points.map((point) => {
      const mesures = point.marges;
      return mesures === undefined
        ? 0
        : moyenne([mesures.batterie, mesures.stockage, mesures.deltaV, mesures.carburant]);
    }),
  );
  const technique = SCORE_TECHNIQUE * moyenne([disponibilite, marges]);
  const budgetMax = entree.scenario.budgetMaxMUSD;
  exiger(Number.isFinite(budgetMax) && budgetMax > 0, "BUDGET_SCENARIO_INVALIDE");
  const ratioBudgetUtilise = entree.configuration.orbiteur.coutMUSD / budgetMax;
  const donneesGenerees = entree.resultat.donneesGenereesGbit;
  if (donneesGenerees === undefined) throw new ErreurEvaluation("MESURES_DONNEES_ABSENTES");
  const ratioDonneesPerdues =
    donneesGenerees === 0
      ? entree.resultat.donneesPerduesGbit === 0
        ? 0
        : 1
      : entree.resultat.donneesPerduesGbit / donneesGenerees;
  const ressources =
    SCORE_RESSOURCES * moyenne([1 - borner(ratioBudgetUtilise), 1 - borner(ratioDonneesPerdues)]);
  const profil = entree.configuration.profilOperations;
  if (profil === undefined) throw new ErreurEvaluation("PROFIL_OPERATIONS_REQUIS");
  const penaliteRisque = entree.resultat.decisionsCrise.some(
    (decision) => decision.choix === "poursuivre",
  )
    ? profil.crise.penaliteRisqueAccru
    : 0;
  const fiabilite = SCORE_FIABILITE * calculerFiabilite(entree) * (1 - penaliteRisque);
  const collab =
    entree.mode === "solo"
      ? 0
      : SCORE_COLLABORATION *
        (entree.collaboration?.tauxParticipation ?? 0) *
        (1 - (entree.collaboration?.conflits ?? 1));
  const scoreAvantRedistribution = progression.score + technique + ressources + fiabilite + collab;
  const scoreTotal =
    entree.mode === "solo"
      ? scoreAvantRedistribution * (1000 / PLAFOND_SANS_COLLABORATION)
      : scoreAvantRedistribution;
  return {
    science: progression.score,
    sciencesAtteintes: progression.nombreAtteints,
    moyenneDisponibilite: disponibilite,
    moyenneMarges: marges,
    technique,
    ratioBudgetUtilise,
    ratioDonneesPerdues,
    ressources,
    fiabilite: fiabilite,
    penaliteRisque,
    scoreTotal,
  };
}

function nombreRegle(regle: Record<string, unknown>, cle: string): number {
  const valeur = regle[cle];
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
    throw new ErreurEvaluation("REGLE_SCENARIO_INVALIDE", { champ: cle });
  }
  return valeur;
}

function regleSatisfaite(
  type: string,
  regle: Record<string, unknown>,
  entree: EntreeEvaluation,
  mesures: MesuresEvaluation,
): boolean {
  switch (type) {
    case "scienceMinimale":
      return mesures.science / SCORE_SCIENCE >= nombreRegle(regle, "seuil");
    case "budgetRespecte":
      return mesures.ratioBudgetUtilise <= nombreRegle(regle, "seuil");
    case "objectifsAtteints":
      return mesures.sciencesAtteintes >= nombreRegle(regle, "minimum");
    case "dureeVieSuffisante": {
      const dureeCible = entree.configuration.profilOperations?.dureeCibleJours;
      if (dureeCible === undefined || dureeCible <= 0) {
        throw new ErreurEvaluation("PROFIL_OPERATIONS_REQUIS");
      }
      return entree.resultat.dureeSimuleeJours / dureeCible >= nombreRegle(regle, "seuil");
    }
    case "missionPerdue":
      return (entree.resultat.issue === "perdue" ? 1 : 0) >= nombreRegle(regle, "seuil");
    case "missionNonPerdue":
      return entree.resultat.issue !== "perdue";
    default:
      throw new ErreurEvaluation("TYPE_REGLE_SCENARIO_INCONNU", { type });
  }
}

function choisirFin(entree: EntreeEvaluation, mesures: MesuresEvaluation): "A" | "B" | "C" | "D" {
  const scenario: PaquetScenario = entree.scenario;
  for (const fin of [...scenario.fins].sort((a, b) => a.code.localeCompare(b.code))) {
    exiger(fin.regles.length > 0, "FIN_SCENARIO_SANS_REGLES", { fin: fin.code });
    const satisfaite = fin.regles.every((regle) => {
      const type = regle.type;
      if (typeof type !== "string") {
        throw new ErreurEvaluation("REGLE_SCENARIO_INVALIDE", { fin: fin.code });
      }
      return regleSatisfaite(type, regle, entree, mesures);
    });
    if (satisfaite) return fin.code;
  }
  // B3 (audit) : un paquet dont les fins ne couvrent pas toutes les issues ne doit pas faire
  // échouer la clôture (500). Repli déterministe sur la dernière fin (la plus sévère, par code).
  const derniere = [...scenario.fins].sort((a, b) => a.code.localeCompare(b.code)).at(-1);
  if (derniere === undefined) throw new ErreurEvaluation("AUCUNE_FIN_SCENARIO_SATISFAITE");
  return derniere.code;
}

function explication(code: string, params: Record<string, number | string> = {}): CodeExplication {
  return { version: 1, code, params };
}

function determinerCauses(entree: EntreeEvaluation, mesures: MesuresEvaluation): CodeExplication[] {
  const causes: CodeExplication[] = [];
  if (mesures.science / SCORE_SCIENCE < 0.9) {
    causes.push(
      explication(CODES_EVALUATION.SCIENCE_INCOMPLETE, {
        progression: mesures.science / SCORE_SCIENCE,
      }),
    );
  }
  if (mesures.moyenneDisponibilite < 0.9 || mesures.moyenneMarges < 0.9) {
    causes.push(
      explication(CODES_EVALUATION.MARGES_TECHNIQUES_FAIBLES, {
        disponibilite: mesures.moyenneDisponibilite,
        marges: mesures.moyenneMarges,
      }),
    );
  }
  if (mesures.ratioDonneesPerdues > 0.1) {
    causes.push(
      explication(CODES_EVALUATION.DONNEES_PERDUES, {
        ratio: mesures.ratioDonneesPerdues,
        perduesGbit: entree.resultat.donneesPerduesGbit,
      }),
    );
  }
  if (mesures.ratioBudgetUtilise > 0.9) {
    causes.push(
      explication(CODES_EVALUATION.BUDGET_MARGE_FAIBLE, {
        ratio: mesures.ratioBudgetUtilise,
        coutMUSD: entree.configuration.orbiteur.coutMUSD,
      }),
    );
  }
  if (mesures.fiabilite / SCORE_FIABILITE < 0.9) {
    causes.push(
      explication(CODES_EVALUATION.FIABILITE_FAIBLE, {
        fiabilite: mesures.fiabilite / SCORE_FIABILITE,
      }),
    );
  }
  if (mesures.penaliteRisque > 0) {
    causes.push(explication(CODES_EVALUATION.RISQUE_ACCRU, { penalite: mesures.penaliteRisque }));
  }
  if (mesures.sciencesAtteintes < entree.configuration.objectifs.secondaires.length + 1) {
    causes.push(
      explication(CODES_EVALUATION.OBJECTIFS_NON_ATTEINTS, {
        atteints: mesures.sciencesAtteintes,
        total: entree.configuration.objectifs.secondaires.length + 1,
      }),
    );
  }
  if (entree.resultat.issue === "ecourtee") {
    causes.push(
      explication(CODES_EVALUATION.MISSION_ECOURTEE, {
        jours: entree.resultat.dureeSimuleeJours,
      }),
    );
  } else if (entree.resultat.issue === "perdue") {
    causes.push(
      explication(CODES_EVALUATION.MISSION_PERDUE, {
        jours: entree.resultat.dureeSimuleeJours,
      }),
    );
  }
  for (const evenement of entree.resultat.evenements) {
    if (evenement.type.startsWith("INDICE_")) continue;
    causes.push(
      explication(CODES_EVALUATION.EVENEMENT_MISSION, {
        evenement: evenement.type,
        jour: evenement.jour,
      }),
    );
  }
  return causes;
}

function codePiste(codeCause: string): string {
  switch (codeCause) {
    case CODES_EVALUATION.SCIENCE_INCOMPLETE:
      return CODES_EVALUATION.RECOMMANDATION_SCIENCE;
    case CODES_EVALUATION.MARGES_TECHNIQUES_FAIBLES:
      return CODES_EVALUATION.RECOMMANDATION_ENERGIE;
    case CODES_EVALUATION.DONNEES_PERDUES:
      return CODES_EVALUATION.RECOMMANDATION_DONNEES;
    case CODES_EVALUATION.BUDGET_DEPASSE:
      return CODES_EVALUATION.RECOMMANDATION_BUDGET;
    case CODES_EVALUATION.OBJECTIFS_NON_ATTEINTS:
      return CODES_EVALUATION.RECOMMANDATION_OBJECTIFS;
    default:
      return CODES_EVALUATION.RECOMMANDATION_FIABILITE;
  }
}

function determinerRecommandations(causes: readonly CodeExplication[]) {
  const recommandations = causes.map((cause) => ({
    pourquoi: cause,
    piste: explication(codePiste(cause.code), { cause: cause.code }),
  }));
  return recommandations;
}

export function evaluerBilan(entreeBrute: EntreeEvaluation): BilanMission {
  const entree = validerEntree(entreeBrute);
  const mesures = obtenirMesures(entree);
  const causes = determinerCauses(entree, mesures);
  const bilan = {
    version: 2 as const,
    mode: entree.mode,
    missionRef: entree.missionId,
    scoreTotal: mesures.scoreTotal,
    scores:
      entree.mode === "solo"
        ? {
            science: (mesures.science * 1000) / PLAFOND_SANS_COLLABORATION,
            technique: (mesures.technique * 1000) / PLAFOND_SANS_COLLABORATION,
            ressources: (mesures.ressources * 1000) / PLAFOND_SANS_COLLABORATION,
            fiabilite: (mesures.fiabilite * 1000) / PLAFOND_SANS_COLLABORATION,
            collab: 0 as const,
          }
        : {
            science: mesures.science,
            technique: mesures.technique,
            ressources: mesures.ressources,
            fiabilite: mesures.fiabilite,
            collab:
              SCORE_COLLABORATION *
              (entree.collaboration?.tauxParticipation ?? 0) *
              (1 - (entree.collaboration?.conflits ?? 1)),
          },
    fin: choisirFin(entree, mesures),
    causes,
    decisionsCles: [...entree.resultat.decisionsCrise]
      .sort((a, b) => a.jour - b.jour || a.id.localeCompare(b.id))
      .map((decision) => decision.id),
    recommandations: determinerRecommandations(causes),
  };
  return schemaBilanMission.parse(bilan);
}

export function evaluer(entree: EntreeEvaluation): BilanMission {
  return evaluerBilan(entree);
}

export function genererRapport(
  entreeBrute: EntreeEvaluation,
  bilanBrut?: BilanMission,
): RapportMission {
  const entree = validerEntree(entreeBrute);
  const bilan = bilanBrut ?? evaluerBilan(entree);
  const chronologie = [
    ...entree.resultat.evenements.map((evenement) => ({
      jour: evenement.jour,
      type: "evenement" as const,
      reference: evenement.id,
      code: evenement.type,
    })),
    ...entree.resultat.decisionsCrise.map((decision) => ({
      jour: decision.jour,
      type: "decision" as const,
      reference: decision.id,
      code: decision.choix,
    })),
  ].sort(
    (a, b) =>
      a.jour - b.jour || a.type.localeCompare(b.type) || a.reference.localeCompare(b.reference),
  );
  const missionsReelles = [
    ...new Set(
      entree.configuration.orbiteur.instruments.flatMap(
        (instrument) => instrument.missionsReelles ?? [],
      ),
    ),
  ].sort();
  return schemaRapportMission.parse({
    version: 1,
    bilan,
    configuration: entree.configuration,
    resultat: entree.resultat,
    chronologie,
    leconsApprises: bilan.recommandations,
    rejouer: bilan.fin === "D",
    ...(missionsReelles.length > 0 ? { missionsReellesComparables: missionsReelles } : {}),
  });
}

export function exporterRapportJson(rapportBrut: RapportMission): string {
  const rapport = schemaRapportMission.parse(rapportBrut);
  return JSON.stringify(rapport, null, 2);
}
