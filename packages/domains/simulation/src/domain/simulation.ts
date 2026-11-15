import {
  CODES_SIMULATION,
  schemaChoixCrise,
  schemaCommandeSimulation,
  schemaConfigurationFigee,
  schemaDecisionCriseApp,
  schemaDefinitionEvenement,
  schemaEtatSousSysteme,
  schemaEvenementApplique,
  schemaOptionsDemarrageSimulation,
  schemaPointJournalier,
  schemaProfilOperations,
  schemaResultatSimulation,
  schemaSimulationTerminee,
  schemaMissionLancee,
  schemaAnomalieDetectee,
  schemaCriseDecidee,
  schemaId,
  schemaIssueSimulation,
  type ChoixCrise,
  type CommandeSimulation,
  type ConfigurationFigee,
  type DecisionCriseApp,
  type DefinitionEvenement,
  type EtatSousSysteme,
  type EvenementApplique,
  type EvenementDomaine,
  type IssueSimulation,
  type OptionsDemarrageSimulation,
  type ProgressionSimulation,
  type ProfilOperations,
  type ResultatSimulation,
} from "@smdg/contracts";
import { mulberry32, tirerMulberry32 } from "@smdg/kernel";
import { G0_MSS, periode } from "@smdg/physics";
import { z } from "zod";

import { ErreurSimulation, expliquerSimulation } from "./erreur-simulation.js";
import type { EtatSimulation, TransitionSimulation } from "./types.js";

const SECONDES_PAR_JOUR = 86400;
const MILLIONS_BITS_PAR_GBIT = 1000;
const SYSTEMES_EN_LIGNE: EtatSousSysteme = "operationnel";

const schemaEtatSimulation = z.object({
  version: z.literal(1),
  missionId: schemaOptionsDemarrageSimulation.shape.missionId,
  simulationId: schemaOptionsDemarrageSimulation.shape.simulationId,
  configuration: schemaConfigurationFigee,
  definitionsEvenements: z.array(schemaDefinitionEvenement),
  graine: z.number().int(),
  etatRng: z.number().int().min(0).max(0xffffffff),
  tiragesRng: z.number().int().nonnegative(),
  jour: z.number().int().nonnegative(),
  limiteJours: z.number().int().positive(),
  issue: schemaIssueSimulation,
  terminee: z.boolean(),
  batterieWh: z.number().nonnegative(),
  tamponGbit: z.number().nonnegative(),
  donneesGenereesGbit: z.number().nonnegative(),
  donneesTransmisesGbit: z.number().nonnegative(),
  donneesPerduesGbit: z.number().nonnegative(),
  scienceCumulee: z.number().nonnegative(),
  scienceMax: z.number().nonnegative(),
  scienceParObjectif: z.record(schemaId, z.number().nonnegative()),
  scienceMaxParObjectif: z.record(schemaId, z.number().nonnegative()),
  carburantRestantKg: z.number().nonnegative(),
  deltaVRestantMs: z.number().nonnegative(),
  instrumentsActifs: z.array(z.string()),
  observationsPlanifiees: z.array(z.string()),
  transmissionActive: z.boolean(),
  facteurTransmission: z.number().min(0).max(1),
  modeBasseConsommation: z.boolean(),
  observationsSuspenduesJusqua: z.number().int().nonnegative(),
  risqueAccru: z.boolean(),
  objectifsSacrifies: z.array(z.string()),
  sousSystemes: z.record(schemaId, schemaEtatSousSysteme),
  serie: z.array(schemaPointJournalier),
  evenements: z.array(schemaEvenementApplique),
  decisionsCrise: z.array(schemaDecisionCriseApp),
  commandesPlanifiees: z.array(schemaCommandeSimulation),
  evenementsPlanifies: z.array(z.object({ definitionId: schemaId, jour: z.number().int() })),
  criseEnAttente: z
    .object({ jour: z.number().int().nonnegative(), echeance: z.number().int().positive() })
    .nullable(),
  anomalieEnergetiqueEmise: z.boolean(),
});

type EtatMutable = { -readonly [K in keyof EtatSimulation]: EtatSimulation[K] };

function mutable(etat: EtatSimulation): EtatMutable {
  return structuredClone(etat) as EtatMutable;
}

function profilDe(configuration: ConfigurationFigee): ProfilOperations {
  const resultat = schemaConfigurationFigee.safeParse(configuration);
  if (!resultat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "configuration-c3-invalide",
      }),
    );
  }
  const profil = schemaProfilOperations.safeParse(resultat.data.profilOperations);
  if (!profil.success) {
    throw new ErreurSimulation(
      expliquerSimulation(
        resultat.data.profilOperations === undefined
          ? CODES_SIMULATION.PROFIL_OPERATIONS_REQUIS
          : CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE,
        { champs: profil.error.issues.map((issue) => issue.path.join(".")).join(",") },
      ),
    );
  }
  return profil.data;
}

function validerEvenement(
  evenement: DefinitionEvenement,
  configuration: ConfigurationFigee,
): DefinitionEvenement | undefined {
  const resultat = schemaDefinitionEvenement.safeParse(evenement);
  if (!resultat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "definition-evenement-invalide",
      }),
    );
  }
  const { impact, cibleId, ampleur } = resultat.data;
  if (impact === "instrument" || impact === "objectif") {
    if (cibleId === undefined) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
          evenement: evenement.type,
          motif: "impact-evenement-incomplet",
        }),
      );
    }
    if (
      impact === "instrument" &&
      !configuration.orbiteur.instruments.some(
        (instrument) => instrument.idCatalogue === cibleId,
      )
    ) {
      return undefined;
    }
    if (
      impact === "objectif" &&
      configuration.objectifs.principal !== cibleId &&
      !configuration.objectifs.secondaires.includes(cibleId)
    ) {
      return undefined;
    }
  } else if (ampleur === undefined) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        evenement: evenement.type,
        motif: "impact-evenement-incomplet",
      }),
    );
  }
  return resultat.data;
}

function validerConfiguration(configuration: ConfigurationFigee): ProfilOperations {
  const profil = profilDe(configuration);
  const systemes = [
    ...configuration.orbiteur.elements.map((element) => element.idCatalogue),
    ...configuration.orbiteur.instruments.map((instrument) => instrument.idCatalogue),
  ];
  const systemesSansMtbf = systemes.filter((id) => profil.mtbfJoursParSysteme[id] === undefined);
  const batterie = configuration.orbiteur.capaciteBatterieWh;
  if (
    systemesSansMtbf.length > 0 ||
    profil.batterieInitialeWh > batterie ||
    profil.seuilBatterieCritique > profil.seuilBatterieDegrade
  ) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        champs:
          systemesSansMtbf.length > 0
            ? `mtbfJoursParSysteme.${systemesSansMtbf.join(",")}`
            : profil.batterieInitialeWh > batterie
              ? "batterieInitialeWh"
              : "seuilBatterieCritique",
      }),
    );
  }
  if (!configuration.bilans.some((bilan) => bilan.type === "batterie")) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        champs: "bilans.batterie",
      }),
    );
  }
  return profil;
}

function hash32(texte: string): number {
  let resultat = 2166136261;
  for (let index = 0; index < texte.length; index += 1) {
    resultat = Math.imul(resultat ^ texte.charCodeAt(index), 16777619);
  }
  return resultat >>> 0;
}

function uuidDeterministe(graine: number, identifiant: string): string {
  const aleatoire = mulberry32(hash32(`${graine}:${identifiant}`));
  const octets = Array.from({ length: 16 }, () => Math.floor(aleatoire() * 256));
  octets[6] = (octets[6]! & 0x0f) | 0x40;
  octets[8] = (octets[8]! & 0x3f) | 0x80;
  const hex = octets.map((octet) => octet.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function tirer(etat: EtatMutable): number {
  const tirage = tirerMulberry32(etat.etatRng);
  etat.etatRng = tirage.etat;
  etat.tiragesRng += 1;
  return tirage.valeur;
}

function initialiserSousSystemes(
  configuration: ConfigurationFigee,
): Record<string, EtatSousSysteme> {
  return Object.fromEntries(
    [
      ...configuration.orbiteur.elements.map((element) => element.idCatalogue),
      ...configuration.orbiteur.instruments.map((instrument) => instrument.idCatalogue),
    ]
      .sort()
      .map((id) => [id, SYSTEMES_EN_LIGNE]),
  );
}

function initialiserScienceParObjectif(
  configuration: ConfigurationFigee,
  dureeJours: number,
): { cumulee: Record<string, number>; maximum: Record<string, number> } {
  const maximum: Record<string, number> = {};
  for (const instrument of configuration.orbiteur.instruments) {
    const objectifs = instrument.objectifs ?? [];
    if (objectifs.length === 0) continue;
    const part = (instrument.valeurScientifique * dureeJours) / objectifs.length;
    for (const objectif of objectifs) maximum[objectif] = (maximum[objectif] ?? 0) + part;
  }
  const cumulee = Object.fromEntries(Object.keys(maximum).map((objectif) => [objectif, 0]));
  return { cumulee, maximum };
}

function bornerRatio(ratio: number): number {
  return Math.min(1, Math.max(0, ratio));
}

function mesurerMarges(etat: EtatMutable): {
  batterie: number;
  stockage: number;
  deltaV: number;
  carburant: number;
} {
  const profil = profilDe(etat.configuration);
  const capaciteBatterie = etat.configuration.orbiteur.capaciteBatterieWh;
  const margeBatterie =
    capaciteBatterie <= 0 || profil.seuilBatterieCritique >= 1
      ? 0
      : (etat.batterieWh / capaciteBatterie - profil.seuilBatterieCritique) /
        (1 - profil.seuilBatterieCritique);
  const capaciteStockage = profil.capaciteStockageGbit;
  return {
    batterie: bornerRatio(margeBatterie),
    stockage:
      capaciteStockage <= 0
        ? etat.tamponGbit <= 0
          ? 1
          : 0
        : bornerRatio(1 - etat.tamponGbit / capaciteStockage),
    deltaV:
      profil.reserveDeltaVms <= 0 ? 1 : bornerRatio(etat.deltaVRestantMs / profil.reserveDeltaVms),
    carburant:
      etat.configuration.orbiteur.carburantKg <= 0
        ? 1
        : bornerRatio(etat.carburantRestantKg / etat.configuration.orbiteur.carburantKg),
  };
}

function disponibiliteSousSystemes(etat: EtatMutable): number {
  const etats = Object.values(etat.sousSystemes);
  return etats.length === 0
    ? 0
    : etats.filter((etatSysteme) => etatSysteme !== "horsLigne").length / etats.length;
}

function terminerEtat(etat: EtatMutable, issue: IssueSimulation): void {
  etat.issue = issue;
  etat.terminee = true;
  etat.criseEnAttente = null;
}

function terminerSelonLimite(etat: EtatMutable): EvenementDomaine | undefined {
  if (etat.terminee || etat.jour < etat.limiteJours || etat.criseEnAttente !== null) {
    return undefined;
  }
  const profil = profilDe(etat.configuration);
  const issue: IssueSimulation =
    etat.limiteJours < profil.dureeCibleJours ? "ecourtee" : "nominale";
  terminerEtat(etat, issue);
  return schemaSimulationTerminee.parse({
    type: "SimulationTerminée",
    version: 1,
    missionId: etat.missionId,
    simulationId: etat.simulationId,
    issue,
  });
}

function transition(
  etat: EtatMutable,
  evenements: readonly EvenementDomaine[] = [],
): TransitionSimulation {
  return { etat, evenements };
}

export function calculerFiabilite(mtbfJours: readonly number[], dureeJours: number): number {
  if (
    !Number.isFinite(dureeJours) ||
    dureeJours < 0 ||
    mtbfJours.some((mtbf) => !Number.isFinite(mtbf) || mtbf <= 0)
  ) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        champs: "mtbfJours",
      }),
    );
  }
  return [...mtbfJours]
    .sort((a, b) => a - b)
    .reduce((fiabilite, mtbf) => {
      return fiabilite * Math.exp(-dureeJours / mtbf);
    }, 1);
}

export function calculerDureeEclipseS(configuration: ConfigurationFigee): number {
  return periode(configuration.orbite.altitudeKm) * configuration.orbite.fractionEclipse;
}

export function capaciteDescenteGbitJour(configuration: ConfigurationFigee): number {
  const profil = profilDe(configuration);
  return (profil.debitLiaisonMbps * profil.tempsContactSParJour) / MILLIONS_BITS_PAR_GBIT;
}

export function demarrer(options: OptionsDemarrageSimulation): TransitionSimulation {
  const entree = schemaOptionsDemarrageSimulation.safeParse(options);
  if (!entree.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        champs: entree.error.issues.map((issue) => issue.path.join(".")).join(","),
      }),
    );
  }
  const { configuration, graine, missionId, simulationId } = entree.data;
  const profil = validerConfiguration(configuration);
  const definitionsEvenements = entree.data.definitionsEvenements
    .map((definition) => validerEvenement(definition, configuration))
    .filter((definition): definition is DefinitionEvenement => definition !== undefined);
  const limiteJours = Math.min(
    profil.dureeCibleJours,
    profil.limitesVieJours.degradationPanneaux,
    profil.limitesVieJours.autonomieCarburant,
    profil.limitesVieJours.toleranceRadiation,
  );
  const scienceMax =
    configuration.orbiteur.instruments.reduce((total, instrument) => {
      return total + instrument.valeurScientifique;
    }, 0) * limiteJours;
  const progressionScientifique = initialiserScienceParObjectif(configuration, limiteJours);
  const etat: EtatMutable = {
    version: 1,
    missionId,
    simulationId,
    configuration: structuredClone(configuration),
    definitionsEvenements,
    graine,
    etatRng: graine >>> 0,
    tiragesRng: 0,
    jour: 0,
    limiteJours,
    issue: "nominale",
    terminee: false,
    batterieWh: profil.batterieInitialeWh,
    tamponGbit: 0,
    donneesGenereesGbit: 0,
    donneesTransmisesGbit: 0,
    donneesPerduesGbit: 0,
    scienceCumulee: 0,
    scienceMax,
    scienceParObjectif: progressionScientifique.cumulee,
    scienceMaxParObjectif: progressionScientifique.maximum,
    carburantRestantKg: configuration.orbiteur.carburantKg,
    deltaVRestantMs: profil.reserveDeltaVms,
    instrumentsActifs: configuration.orbiteur.instruments.map(
      (instrument) => instrument.idCatalogue,
    ),
    observationsPlanifiees: configuration.orbiteur.instruments.map(
      (instrument) => instrument.idCatalogue,
    ),
    transmissionActive: true,
    facteurTransmission: 1,
    modeBasseConsommation: false,
    observationsSuspenduesJusqua: 0,
    risqueAccru: false,
    objectifsSacrifies: [],
    sousSystemes: initialiserSousSystemes(configuration),
    serie: [],
    evenements: [],
    decisionsCrise: [],
    commandesPlanifiees: [],
    evenementsPlanifies: [],
    criseEnAttente: null,
    anomalieEnergetiqueEmise: false,
  };
  const evenementLancee: EvenementDomaine = schemaMissionLancee.parse({
    type: "MissionLancée",
    version: 1,
    missionId,
    simulationId,
    graine,
  });
  if (tirer(etat) > configuration.lanceur.fiabilite) {
    terminerEtat(etat, "perdue");
    const evenementTerminee = schemaSimulationTerminee.parse({
      type: "SimulationTerminée",
      version: 1,
      missionId,
      simulationId,
      issue: "perdue",
    });
    return transition(etat, [evenementLancee, evenementTerminee]);
  }
  return transition(etat, [evenementLancee]);
}

function puissanceConsommee(etat: EtatMutable, observationsActives: ReadonlySet<string>): number {
  let watts = 0;
  for (const element of etat.configuration.orbiteur.elements) {
    if (etat.sousSystemes[element.idCatalogue] === "horsLigne") continue;
    // Audit front↔back : comme la validation (CON), ni les panneaux ni la batterie ne consomment ;
    // les pertes de la batterie sont déjà comptées par le rendement η.
    if (element.categorie === "energie-panneau" || element.categorie === "energie-batterie") continue;
    if (element.dutyCycle === undefined) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
          champ: `dutyCycle.${element.idCatalogue}`,
        }),
      );
    }
    watts += element.powerW * element.dutyCycle;
  }
  for (const instrument of etat.configuration.orbiteur.instruments) {
    if (
      etat.sousSystemes[instrument.idCatalogue] === "horsLigne" ||
      !observationsActives.has(instrument.idCatalogue)
    ) {
      continue;
    }
    if (instrument.dutyCycle === undefined) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
          champ: `dutyCycle.${instrument.idCatalogue}`,
        }),
      );
    }
    watts += instrument.powerW * instrument.dutyCycle;
  }
  const profil = profilDe(etat.configuration);
  return etat.modeBasseConsommation ? watts * profil.crise.facteurBasseConsommation : watts;
}

function puissanceProduite(etat: EtatMutable): number {
  if (etat.jour >= profilDe(etat.configuration).limitesVieJours.degradationPanneaux) {
    return 0;
  }
  const panneaux = etat.configuration.orbiteur.elements.filter(
    (element) => element.categorie === "energie-panneau",
  );
  if (panneaux.length === 0) return etat.configuration.orbiteur.puissanceProduiteW;
  const nominale = panneaux.reduce((total, panneau) => total + panneau.powerW, 0);
  if (nominale <= 0) return 0;
  const active = panneaux.reduce((total, panneau) => {
    return etat.sousSystemes[panneau.idCatalogue] === "horsLigne" ? total : total + panneau.powerW;
  }, 0);
  const anomalie = profilDe(etat.configuration).anomalieScenarisee;
  const facteurAnomalie = anomalie !== undefined && etat.jour >= anomalie.jour ? anomalie.facteurProduction : 1;
  return etat.configuration.orbiteur.puissanceProduiteW * (active / nominale) * facteurAnomalie;
}

function avancerBatterie(
  etat: EtatMutable,
  puissanceW: number,
  consommationW: number,
): { batterieWh: number; deficitEclipse: boolean } {
  const profil = profilDe(etat.configuration);
  const capaciteWh = etat.configuration.orbiteur.capaciteBatterieWh;
  const dureeOrbiteS = periode(etat.configuration.orbite.altitudeKm);
  const fractionEclipse = etat.configuration.orbite.fractionEclipse;
  let tempsRestantS = SECONDES_PAR_JOUR;
  let batterieWh = etat.batterieWh;
  let deficitEclipse = false;
  while (tempsRestantS > 0) {
    const dureeOrbiteCouranteS = Math.min(dureeOrbiteS, tempsRestantS);
    const eclipseS = dureeOrbiteCouranteS * fractionEclipse;
    const soleilS = dureeOrbiteCouranteS - eclipseS;
    const besoinEclipseWh = (consommationW * eclipseS) / 3600;
    if (batterieWh < besoinEclipseWh) deficitEclipse = true;
    batterieWh = Math.max(0, batterieWh - besoinEclipseWh);
    batterieWh = Math.min(
      capaciteWh,
      Math.max(0, batterieWh + ((puissanceW - consommationW) * soleilS) / 3600),
    );
    tempsRestantS -= dureeOrbiteCouranteS;
  }
  if (profil.batterieInitialeWh > capaciteWh) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        champ: "batterieInitialeWh",
      }),
    );
  }
  return { batterieWh, deficitEclipse };
}

function ajouterEvenement(etat: EtatMutable, evenement: EvenementApplique): void {
  etat.evenements = [...etat.evenements, schemaEvenementApplique.parse(evenement)];
}

function appliquerEvenement(
  etat: EtatMutable,
  definition: DefinitionEvenement,
  jour: number,
): void {
  if (definition.impact === "instrument" && definition.cibleId !== undefined) {
    etat.instrumentsActifs = etat.instrumentsActifs.filter((id) => id !== definition.cibleId);
    etat.observationsPlanifiees = etat.observationsPlanifiees.filter(
      (id) => id !== definition.cibleId,
    );
    etat.sousSystemes = { ...etat.sousSystemes, [definition.cibleId]: "horsLigne" };
  } else if (definition.impact === "donnees" && definition.ampleur !== undefined) {
    const perdues = Math.min(etat.tamponGbit, definition.ampleur);
    etat.tamponGbit -= perdues;
    etat.donneesPerduesGbit += perdues;
  } else if (definition.impact === "objectif" && definition.cibleId !== undefined) {
    etat.objectifsSacrifies = [...etat.objectifsSacrifies, definition.cibleId];
  } else if (definition.impact === "dureeVie" && definition.ampleur !== undefined) {
    etat.limiteJours = Math.max(jour, etat.limiteJours - Math.ceil(definition.ampleur));
  }
  ajouterEvenement(etat, {
    id: uuidDeterministe(etat.graine, `evenement:${definition.id}:${jour}`),
    type: definition.type,
    jour,
    origine: definition.origine,
    impact: definition.impact,
    ...(definition.cibleId !== undefined ? { cibleId: definition.cibleId } : {}),
    ...(definition.ampleur !== undefined ? { ampleur: definition.ampleur } : {}),
  });
}

function activerCommandes(etat: EtatMutable, jour: number): void {
  const restant: CommandeSimulation[] = [];
  for (const commande of etat.commandesPlanifiees) {
    if (commande.jour !== jour) {
      restant.push(commande);
      continue;
    }
    if (commande.type === "planifier-observation") {
      if (commande.active && etat.instrumentsActifs.includes(commande.instrumentId)) {
        etat.observationsPlanifiees = [
          ...new Set([...etat.observationsPlanifiees, commande.instrumentId]),
        ];
      } else {
        etat.observationsPlanifiees = etat.observationsPlanifiees.filter(
          (id) => id !== commande.instrumentId,
        );
      }
    } else if (commande.type === "programmer-transmission") {
      etat.transmissionActive = commande.active;
    } else {
      if (commande.deltaVms > etat.deltaVRestantMs) {
        throw new ErreurSimulation(
          expliquerSimulation(CODES_SIMULATION.DV_INSUFFISANT, {
            demandeMps: commande.deltaVms,
            disponibleMps: etat.deltaVRestantMs,
          }),
        );
      }
      const masseMouilléeKg = etat.configuration.orbiteur.masseSecheKg + etat.carburantRestantKg;
      const carburantUtiliseKg =
        masseMouilléeKg *
        (1 - Math.exp(-commande.deltaVms / (profilDe(etat.configuration).ispS * G0_MSS)));
      if (carburantUtiliseKg > etat.carburantRestantKg) {
        throw new ErreurSimulation(
          expliquerSimulation(CODES_SIMULATION.DV_INSUFFISANT, {
            carburantDemandeKg: carburantUtiliseKg,
            carburantDisponibleKg: etat.carburantRestantKg,
          }),
        );
      }
      etat.carburantRestantKg = Math.max(0, etat.carburantRestantKg - carburantUtiliseKg);
      etat.deltaVRestantMs = Math.max(0, etat.deltaVRestantMs - commande.deltaVms);
    }
  }
  etat.commandesPlanifiees = restant;
}

function traiterPannes(etat: EtatMutable): void {
  const profil = profilDe(etat.configuration);
  const ids = Object.keys(etat.sousSystemes).sort();
  for (const id of ids) {
    if (etat.sousSystemes[id] === "horsLigne") continue;
    const mtbf = profil.mtbfJoursParSysteme[id];
    if (mtbf === undefined) continue;
    // La pénalité calibrée multiplie le taux de panne exponentiel du sous-système.
    const facteurRisque = etat.risqueAccru ? 1 + profil.crise.penaliteRisqueAccru : 1;
    const probabilitePanne = 1 - Math.exp(-facteurRisque / mtbf);
    if (tirer(etat) < probabilitePanne) {
      etat.sousSystemes = { ...etat.sousSystemes, [id]: "horsLigne" };
      etat.instrumentsActifs = etat.instrumentsActifs.filter((instrumentId) => instrumentId !== id);
      etat.observationsPlanifiees = etat.observationsPlanifiees.filter(
        (instrumentId) => instrumentId !== id,
      );
    }
  }
}

function planifierEvenements(etat: EtatMutable, jour: number): void {
  for (const definition of etat.definitionsEvenements) {
    if (tirer(etat) < definition.probabilite && jour + 1 <= etat.limiteJours) {
      etat.evenementsPlanifies = [
        ...etat.evenementsPlanifies,
        { definitionId: definition.id, jour: jour + 1 },
      ];
      ajouterEvenement(etat, {
        id: uuidDeterministe(etat.graine, `indice:${definition.id}:${jour}`),
        type: `INDICE_${definition.type}`,
        jour,
        origine: definition.origine,
        impact: definition.impact,
        indice: definition.indice,
        ...(definition.cibleId !== undefined ? { cibleId: definition.cibleId } : {}),
        ...(definition.ampleur !== undefined ? { ampleur: definition.ampleur } : {}),
      });
    }
  }
}

function appliquerEvenementsPlanifies(etat: EtatMutable, jour: number): void {
  const restant: { definitionId: string; jour: number }[] = [];
  for (const programme of etat.evenementsPlanifies) {
    if (programme.jour !== jour) {
      restant.push(programme);
      continue;
    }
    const definition = etat.definitionsEvenements.find(
      (item) => item.id === programme.definitionId,
    );
    if (definition === undefined) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
          definitionEvenement: programme.definitionId,
        }),
      );
    }
    appliquerEvenement(etat, definition, jour);
  }
  etat.evenementsPlanifies = restant;
}

function mettreAJourEtatsEnergie(etat: EtatMutable): void {
  const profil = profilDe(etat.configuration);
  const capacite = etat.configuration.orbiteur.capaciteBatterieWh;
  const fraction = capacite === 0 ? 0 : etat.batterieWh / capacite;
  const etatEnergie: EtatSousSysteme =
    fraction <= 0
      ? "horsLigne"
      : fraction <= profil.seuilBatterieCritique
        ? "critique"
        : fraction <= profil.seuilBatterieDegrade
          ? "degrade"
          : "operationnel";
  const prochains = { ...etat.sousSystemes };
  for (const id of Object.keys(prochains)) {
    if (prochains[id] !== "horsLigne") prochains[id] = etatEnergie;
  }
  etat.sousSystemes = prochains;
}

function appliquerDecision(
  etat: EtatMutable,
  choix: ChoixCrise,
  cibleId: string | undefined,
  jour: number,
  automatique = false,
): EvenementDomaine {
  const profil = profilDe(etat.configuration);
  const choixValide = schemaChoixCrise.safeParse(choix);
  if (!choixValide.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, { choix }),
    );
  }
  if (choix === "desactiver-instrument") {
    if (
      cibleId === undefined ||
      !etat.instrumentsActifs.includes(cibleId) ||
      !etat.configuration.orbiteur.instruments.some(
        (instrument) => instrument.idCatalogue === cibleId,
      )
    ) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, {
          champ: "cibleId",
        }),
      );
    }
    etat.instrumentsActifs = etat.instrumentsActifs.filter((id) => id !== cibleId);
    etat.observationsPlanifiees = etat.observationsPlanifiees.filter((id) => id !== cibleId);
    etat.sousSystemes = { ...etat.sousSystemes, [cibleId]: "horsLigne" };
  } else if (choix === "reduire-transmissions") {
    etat.facteurTransmission = profil.crise.facteurTransmission;
  } else if (choix === "suspendre-observations") {
    etat.observationsSuspenduesJusqua = jour + profil.crise.dureeSuspensionObservationsJours;
  } else if (choix === "basse-consommation") {
    etat.modeBasseConsommation = true;
  } else {
    etat.risqueAccru = true;
  }
  const decision: DecisionCriseApp = schemaDecisionCriseApp.parse({
    id: uuidDeterministe(etat.graine, `decision:${etat.decisionsCrise.length}:${jour}:${choix}`),
    choix,
    jour,
    ...(cibleId !== undefined ? { cibleId } : {}),
  });
  etat.decisionsCrise = [...etat.decisionsCrise, decision];
  etat.criseEnAttente = null;
  return schemaCriseDecidee.parse({
    type: "CriseDécidée",
    version: 1,
    missionId: etat.missionId,
    jour,
    choix: automatique ? "poursuivre" : choix,
  });
}

function validerCommandes(
  etat: EtatSimulation,
  commandes: readonly CommandeSimulation[],
): readonly CommandeSimulation[] {
  return commandes.map((commande) => {
    const resultat = schemaCommandeSimulation.safeParse(commande);
    if (!resultat.success || commande.jour <= etat.jour || commande.jour > etat.limiteJours) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, {
          jour: commande.jour,
        }),
      );
    }
    if (
      commande.type === "planifier-observation" &&
      !etat.configuration.orbiteur.instruments.some(
        (instrument) => instrument.idCatalogue === commande.instrumentId,
      )
    ) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, {
          instrumentId: commande.instrumentId,
        }),
      );
    }
    return resultat.data;
  });
}

function simulerJour(etat: EtatMutable, jour: number): EvenementDomaine[] {
  const profil = profilDe(etat.configuration);
  activerCommandes(etat, jour);
  appliquerEvenementsPlanifies(etat, jour);
  traiterPannes(etat);
  const observationsAutorisees =
    jour > etat.observationsSuspenduesJusqua
      ? new Set(etat.observationsPlanifiees.filter((id) => etat.instrumentsActifs.includes(id)))
      : new Set<string>();
  const observationSecondaires = new Set(
    etat.configuration.orbiteur.instruments
      .filter((instrument) => etat.sousSystemes[instrument.idCatalogue] !== "horsLigne")
      .map((instrument) => instrument.idCatalogue),
  );
  const instrumentsEnObservation = new Set(
    [...observationsAutorisees].filter((id) => observationSecondaires.has(id)),
  );
  const donneesGenereesJour = etat.configuration.orbiteur.instruments.reduce(
    (total, instrument) => {
      if (!instrumentsEnObservation.has(instrument.idCatalogue)) return total;
      const dutyCycle = instrument.dutyCycle;
      if (dutyCycle === undefined) {
        throw new ErreurSimulation(
          expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
            champ: `dutyCycle.${instrument.idCatalogue}`,
          }),
        );
      }
      return (
        total +
        (instrument.dataMbps * dutyCycle * profil.tempsObservationSParJour) / MILLIONS_BITS_PAR_GBIT
      );
    },
    0,
  );
  const donneesDisponibles = etat.tamponGbit + donneesGenereesJour;
  const capaciteTransmission = etat.transmissionActive
    ? capaciteDescenteGbitJour(etat.configuration) * etat.facteurTransmission
    : 0;
  const transmisesJour = Math.min(donneesDisponibles, capaciteTransmission);
  const nonTransmises = donneesDisponibles - transmisesJour;
  const tampon = Math.min(profil.capaciteStockageGbit, nonTransmises);
  const perduesJour = nonTransmises - tampon;
  const fractionTransmise =
    donneesGenereesJour <= 0 ? 0 : Math.min(1, transmisesJour / donneesGenereesJour);
  const sciencePotentielle = etat.configuration.orbiteur.instruments.reduce((total, instrument) => {
    return instrumentsEnObservation.has(instrument.idCatalogue)
      ? total + instrument.valeurScientifique
      : total;
  }, 0);
  const scienceJour = sciencePotentielle * fractionTransmise;
  const progressionJour = { ...etat.scienceParObjectif };
  for (const instrument of etat.configuration.orbiteur.instruments) {
    if (!instrumentsEnObservation.has(instrument.idCatalogue)) continue;
    const objectifs = instrument.objectifs ?? [];
    if (objectifs.length === 0) continue;
    const part = (instrument.valeurScientifique * fractionTransmise) / objectifs.length;
    for (const objectif of objectifs) {
      progressionJour[objectif] = (progressionJour[objectif] ?? 0) + part;
    }
  }
  const puissanceW = puissanceProduite(etat);
  const consommationW = puissanceConsommee(etat, instrumentsEnObservation);
  const energie = avancerBatterie(etat, puissanceW, consommationW);
  etat.jour = jour;
  etat.batterieWh = energie.batterieWh;
  etat.tamponGbit = tampon;
  etat.donneesGenereesGbit += donneesGenereesJour;
  etat.donneesTransmisesGbit += transmisesJour;
  etat.donneesPerduesGbit += perduesJour;
  etat.scienceCumulee += scienceJour;
  mettreAJourEtatsEnergie(etat);
  etat.scienceParObjectif = progressionJour;
  etat.serie = [
    ...etat.serie,
    schemaPointJournalier.parse({
      jour,
      puissanceW,
      batterieWh: etat.batterieWh,
      tamponGbit: etat.tamponGbit,
      science: etat.scienceCumulee,
      scienceParObjectif: progressionJour,
      disponibilite: disponibiliteSousSystemes(etat),
      marges: mesurerMarges(etat),
      donneesGenereesGbit: donneesGenereesJour,
      donneesTransmisesGbit: transmisesJour,
      donneesPerduesGbit: perduesJour,
    }),
  ];
  planifierEvenements(etat, jour);
  const evenements: EvenementDomaine[] = [];
  const bilanBatterie = etat.configuration.bilans.find((bilan) => bilan.type === "batterie");
  if (
    !etat.anomalieEnergetiqueEmise &&
    (energie.deficitEclipse ||
      etat.batterieWh < (bilanBatterie?.consomme ?? 0) ||
      (profil.anomalieScenarisee !== undefined && jour >= profil.anomalieScenarisee.jour))
  ) {
    etat.anomalieEnergetiqueEmise = true;
    etat.criseEnAttente = {
      jour,
      echeance: jour + profil.crise.delaiDecisionJours,
    };
    evenements.push(
      schemaAnomalieDetectee.parse({
        type: "AnomalieDétectée",
        version: 1,
        missionId: etat.missionId,
        jour,
        code: {
          version: 1,
          code: CODES_SIMULATION.ANOMALIE_ENERGETIQUE,
          params: { batterieWh: etat.batterieWh },
        },
      }),
    );
  }
  const evenementTerminee = terminerSelonLimite(etat);
  if (evenementTerminee !== undefined) evenements.push(evenementTerminee);
  return evenements;
}

export function avancer(
  etatInitial: EtatSimulation,
  commandes: readonly CommandeSimulation[],
  jours: number,
): TransitionSimulation {
  const validationEtat = schemaEtatSimulation.safeParse(etatInitial);
  if (!validationEtat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "etat-invalide",
      }),
    );
  }
  if (etatInitial.terminee) {
    throw new ErreurSimulation(expliquerSimulation(CODES_SIMULATION.SIMULATION_TERMINEE));
  }
  if (!Number.isInteger(jours) || jours <= 0) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, { jours }),
    );
  }
  const commandesValidees = validerCommandes(etatInitial, commandes);
  const etat = mutable(etatInitial);
  etat.commandesPlanifiees = [...etat.commandesPlanifiees, ...commandesValidees];
  const finDemandee = etat.jour + jours;
  const evenements: EvenementDomaine[] = [];
  if (etat.criseEnAttente !== null) {
    if (finDemandee < etat.criseEnAttente.echeance) {
      throw new ErreurSimulation(
        expliquerSimulation(CODES_SIMULATION.DECISION_ATTENDUE, {
          echeance: etat.criseEnAttente.echeance,
          jour: etat.jour,
        }),
      );
    }
  }
  const criseDejaOuverte = etat.criseEnAttente !== null;
  for (let jour = etat.jour + 1; jour <= finDemandee && !etat.terminee; jour += 1) {
    if (
      etat.criseEnAttente !== null &&
      (jour >= etat.criseEnAttente.echeance || etat.jour >= etat.limiteJours)
    ) {
      evenements.push(
        appliquerDecision(etat, "poursuivre", undefined, etat.criseEnAttente.echeance, true),
      );
      const evenementTerminee = terminerSelonLimite(etat);
      if (evenementTerminee !== undefined) evenements.push(evenementTerminee);
      if (etat.terminee) break;
    }
    evenements.push(...simulerJour(etat, jour));
    if (etat.criseEnAttente !== null && !criseDejaOuverte) break;
  }
  return transition(etat, evenements);
}

export function decider(
  etatInitial: EtatSimulation,
  choix: ChoixCrise,
  cibleId?: string,
): TransitionSimulation {
  const validationEtat = schemaEtatSimulation.safeParse(etatInitial);
  if (!validationEtat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "etat-invalide",
      }),
    );
  }
  if (etatInitial.terminee) {
    throw new ErreurSimulation(expliquerSimulation(CODES_SIMULATION.SIMULATION_TERMINEE));
  }
  if (etatInitial.criseEnAttente === null) {
    throw new ErreurSimulation(expliquerSimulation(CODES_SIMULATION.DECISION_CRISE_ABSENTE));
  }
  if (etatInitial.jour >= etatInitial.criseEnAttente.echeance) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, {
        echeance: etatInitial.criseEnAttente.echeance,
      }),
    );
  }
  const etat = mutable(etatInitial);
  const evenements: EvenementDomaine[] = [appliquerDecision(etat, choix, cibleId, etat.jour)];
  const evenementTerminee = terminerSelonLimite(etat);
  if (evenementTerminee !== undefined) evenements.push(evenementTerminee);
  return transition(etat, evenements);
}

export function terminer(etatInitial: EtatSimulation): ResultatSimulation {
  const validationEtat = schemaEtatSimulation.safeParse(etatInitial);
  if (!validationEtat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "etat-invalide",
      }),
    );
  }
  const etat = mutable(etatInitial);
  if (!etat.terminee) {
    terminerEtat(etat, etat.jour === 0 ? "perdue" : "ecourtee");
  }
  return schemaResultatSimulation.parse({
    version: 1,
    simulationId: etat.simulationId,
    graine: etat.graine,
    dureeSimuleeJours: etat.jour,
    issue: etat.issue,
    serie: etat.serie,
    evenements: etat.evenements,
    decisionsCrise: etat.decisionsCrise,
    sousSystemes: etat.sousSystemes,
    scienceCumulee: Math.min(etat.scienceCumulee, etat.scienceMax),
    scienceMax: etat.scienceMax,
    donneesPerduesGbit: etat.donneesPerduesGbit,
    donneesGenereesGbit: etat.donneesGenereesGbit,
    donneesTransmisesGbit: etat.donneesTransmisesGbit,
    carburantRestantKg: etat.carburantRestantKg,
    progressionScientifiqueParObjectif: Object.fromEntries(
      Object.keys(etat.scienceMaxParObjectif)
        .sort()
        .map((objectif) => [
          objectif,
          {
            cumulee: etat.scienceParObjectif[objectif] ?? 0,
            maximum: etat.scienceMaxParObjectif[objectif] ?? 0,
          },
        ]),
    ),
  });
}

export function serialiserEtatSimulation(etat: EtatSimulation): string {
  const resultat = schemaEtatSimulation.safeParse(etat);
  if (!resultat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "etat-invalide",
      }),
    );
  }
  return JSON.stringify(resultat.data);
}

export function rehydraterEtatSimulation(etatSerialise: string): EtatSimulation {
  let valeur: unknown;
  try {
    valeur = JSON.parse(etatSerialise) as unknown;
  } catch {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "json-invalide",
      }),
    );
  }
  const resultat = schemaEtatSimulation.safeParse(valeur);
  if (!resultat.success) {
    throw new ErreurSimulation(
      expliquerSimulation(CODES_SIMULATION.PROFIL_OPERATIONS_INVALIDE, {
        motif: "etat-invalide",
      }),
    );
  }
  return resultat.data;
}

export function obtenirProgression(etat: EtatSimulation): ProgressionSimulation {
  const profil = profilDe(etat.configuration);
  return {
    jour: etat.jour,
    dureeCibleJours: profil.dureeCibleJours,
    batterieWh: etat.batterieWh,
    tamponGbit: etat.tamponGbit,
    scienceCumulee: etat.scienceCumulee,
    terminee: etat.terminee,
  };
}
