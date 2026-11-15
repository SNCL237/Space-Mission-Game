import { z } from "zod";
import { schemaDifficulte, schemaId, schemaOrbiteType } from "./commun.js";

// Contrat C3 — ConfigurationFigee : CON → CAM, SIM (Agent.md §4).
// Forme exacte de §6.1 ; version obligatoire (Agent.md §4).

/** Élément figé du catalogue (HYPOTHESE Q-15 : §6.1 référence `ElementFige[]`
 *  sans le décrire ; attributs de `ElementInstalle`, analyse §4.1). */
export const schemaElementFige = z.object({
  idCatalogue: schemaId,
  categorie: z.string().min(1),
  masseKg: z.number(),
  powerW: z.number(),
  dutyCycle: z.number().min(0).max(1).optional(),
  costMUSD: z.number(),
  fiabilite: z.number().min(0).max(1),
});
export type ElementFige = z.infer<typeof schemaElementFige>;

/** Instrument figé (HYPOTHESE Q-15 : attributs de `Instrument`, analyse §4.1). */
export const schemaInstrumentFige = z.object({
  idCatalogue: schemaId,
  /** Objectifs explicitement servis par l'instrument ; absent uniquement sur les C3 historiques. */
  objectifs: z.array(schemaId).min(1).optional(),
  missionsReelles: z.array(z.string().min(1)).optional(),
  masseKg: z.number(),
  powerW: z.number(),
  dutyCycle: z.number().min(0).max(1).optional(),
  costMUSD: z.number(),
  dataMbps: z.number(),
  valeurScientifique: z.number(),
  fiabilite: z.number().min(0).max(1),
});
export type InstrumentFige = z.infer<typeof schemaInstrumentFige>;

/** Bilan de ressources figé (analyse §4.1, `Bilan` de CON — Agent.md §4 :
 *  C3 contient « … difficulté, bilans »). */
export const schemaBilanRessource = z.object({
  type: z.string().min(1),
  capacite: z.number(),
  consomme: z.number(),
  seuilAlerte: z.number(),
});
export type BilanRessource = z.infer<typeof schemaBilanRessource>;

export const schemaProfilOperations = z.object({
  source: z.string().min(1),
  dureeCibleJours: z.number().int().positive(),
  batterieInitialeWh: z.number().nonnegative(),
  capaciteStockageGbit: z.number().nonnegative(),
  debitLiaisonMbps: z.number().nonnegative(),
  tempsContactSParJour: z.number().nonnegative(),
  tempsObservationSParJour: z.number().nonnegative(),
  reserveDeltaVms: z.number().nonnegative(),
  ispS: z.number().positive(),
  seuilBatterieDegrade: z.number().min(0).max(1),
  seuilBatterieCritique: z.number().min(0).max(1),
  mtbfJoursParSysteme: z.record(schemaId, z.number().positive()),
  limitesVieJours: z.object({
    degradationPanneaux: z.number().positive(),
    autonomieCarburant: z.number().positive(),
    toleranceRadiation: z.number().positive(),
  }),
  /** Anomalie scénarisée (GDD, Acte V) : perte d'une partie de la production à un jour donné.
   *  Elle ouvre toujours une décision de crise ; sa gravité dépend des marges de conception. */
  anomalieScenarisee: z
    .object({
      jour: z.number().int().positive(),
      facteurProduction: z.number().min(0).max(1),
    })
    .optional(),
  crise: z.object({
    delaiDecisionJours: z.number().int().positive(),
    facteurTransmission: z.number().min(0).max(1),
    dureeSuspensionObservationsJours: z.number().int().positive(),
    facteurBasseConsommation: z.number().min(0).max(1),
    penaliteRisqueAccru: z.number().min(0).max(1),
  }),
});
export type ProfilOperations = z.infer<typeof schemaProfilOperations>;

export const schemaConfigurationFigee = z.object({
  version: z.number().int().positive(),
  configurationId: schemaId,
  scenarioId: schemaId,
  versionScenario: z.string().min(1),
  versionCatalogue: z.string().min(1),
  orbiteur: z.object({
    masseSecheKg: z.number(),
    carburantKg: z.number(),
    puissanceProduiteW: z.number(),
    puissanceConsommeeW: z.number(),
    capaciteBatterieWh: z.number(),
    coutMUSD: z.number(),
    elements: z.array(schemaElementFige),
    instruments: z.array(schemaInstrumentFige),
  }),
  orbite: z.object({
    type: schemaOrbiteType,
    altitudeKm: z.number(),
    inclinaisonDeg: z.number(),
    fractionEclipse: z.number().min(0).max(1),
  }),
  lanceur: z.object({
    id: schemaId,
    /** Capacité résolue pour l'orbite choisie (Q-14 : la table reste au catalogue). */
    capaciteKg: z.number(),
    fiabilite: z.number().min(0).max(1),
  }),
  objectifs: z.object({
    principal: schemaId,
    secondaires: z.array(schemaId),
  }),
  margeDv: z.number(),
  difficulte: schemaDifficulte,
  bilans: z.array(schemaBilanRessource),
  profilOperations: schemaProfilOperations.optional(),
});
export type ConfigurationFigee = z.infer<typeof schemaConfigurationFigee>;
