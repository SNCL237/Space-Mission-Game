import { z } from "zod";
import { schemaId, schemaIssueSimulation } from "./commun.js";
import { schemaBilanMission } from "./c5-bilan.js";
import { schemaCodeExplication } from "./c7-code.js";

// Contrat C9 — ÉvénementsDomaine : tous → CAM, PED, CLA (Agent.md §4).
// Enveloppe `{ type, version, …charge }` validée par Zod ; le bus `EVENT_BUS`
// refuse toute charge invalide (T1-17).
// HYPOTHESE (Q-15) : les champs de charge détaillés ne sont pas spécifiés en §6.1 ;
// on suit les entités des cahiers (mission opaque, simulation, bilan).

export const schemaMissionCreee = z.object({
  type: z.literal("MissionCréée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  scenarioId: schemaId,
  versionScenario: z.string().min(1),
  utilisateurId: schemaId,
});

export const schemaConceptionValidee = z.object({
  type: z.literal("ConceptionValidée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  configurationId: schemaId,
  versionConfiguration: z.number().int().positive(),
});

export const schemaMissionLancee = z.object({
  type: z.literal("MissionLancée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  simulationId: schemaId,
  graine: z.number().int(),
});

export const schemaAnomalieDetectee = z.object({
  type: z.literal("AnomalieDétectée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  jour: z.number().int().min(0),
  code: schemaCodeExplication,
});

export const schemaCriseDecidee = z.object({
  type: z.literal("CriseDécidée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  jour: z.number().int().min(0),
  choix: z.string().min(1),
});

export const schemaSimulationTerminee = z.object({
  type: z.literal("SimulationTerminée"),
  version: z.number().int().positive(),
  missionId: schemaId,
  simulationId: schemaId,
  issue: schemaIssueSimulation,
});

export const schemaBilanPublie = z.object({
  type: z.literal("BilanPublié"),
  version: z.number().int().positive(),
  missionId: schemaId,
  bilan: schemaBilanMission,
});

export const schemaScenarioDebloque = z.object({
  type: z.literal("ScénarioDébloqué"),
  version: z.number().int().positive(),
  scenarioId: schemaId,
  utilisateurId: schemaId,
});

/** Union discriménée de tous les événements de domaine (C9). */
export const schemaEvenementDomaine = z.discriminatedUnion("type", [
  schemaMissionCreee,
  schemaConceptionValidee,
  schemaMissionLancee,
  schemaAnomalieDetectee,
  schemaCriseDecidee,
  schemaSimulationTerminee,
  schemaBilanPublie,
  schemaScenarioDebloque,
]);

export type MissionCreee = z.infer<typeof schemaMissionCreee>;
export type ConceptionValidee = z.infer<typeof schemaConceptionValidee>;
export type MissionLancee = z.infer<typeof schemaMissionLancee>;
export type AnomalieDetectee = z.infer<typeof schemaAnomalieDetectee>;
export type CriseDecidee = z.infer<typeof schemaCriseDecidee>;
export type SimulationTerminee = z.infer<typeof schemaSimulationTerminee>;
export type BilanPublie = z.infer<typeof schemaBilanPublie>;
export type ScenarioDebloque = z.infer<typeof schemaScenarioDebloque>;
export type EvenementDomaine = z.infer<typeof schemaEvenementDomaine>;

/** Noms d'événements (C9). */
export type NomEvenement = EvenementDomaine["type"];

/** Charge associée à un nom d'événement. */
export type ChargeEvenement<N extends NomEvenement> = Extract<EvenementDomaine, { type: N }>;

/**
 * Port `EVENT_BUS` (C9) : bus en mémoire typé, implémenté dans `apps/server`
 * avec le module d'événements de NestJS et des charges validées par Zod.
 * L'implémentation doit rester remplaçable (cahier de conception §4.2.3).
 */
export interface BusEvenements {
  /** Publie un événement ; une charge invalide est refusée (T1-17). */
  publier<E extends EvenementDomaine>(evenement: E): void;
  /** S'abonne à un événement ; renvoie la fonction de désabonnement. */
  souscrire<N extends NomEvenement>(
    nom: N,
    accueillir: (evenement: ChargeEvenement<N>) => void,
  ): () => void;
}
