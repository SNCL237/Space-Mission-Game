import { z } from "zod";
import {
  schemaEtatSousSysteme,
  schemaId,
  schemaIssueSimulation,
  schemaTypeConsequence,
} from "./commun.js";
import { schemaDefinitionEvenement } from "./c2-scenario.js";
import { schemaConfigurationFigee } from "./c3-configuration.js";

// Contrat C4 — ResultatSimulation : SIM → CAM, EVA (Agent.md §4).
// Forme exacte de §6.1 ; `version` ajoutée (Agent.md §4 : tout contrat porte
// une version) ; sous-objets décrits par les commentaires de §6.1 et l'analyse §4.1.

/** Point de la série journalière (§6.1 : « jour, puissanceW, batterieWh, tamponGbit, science »). */
export const schemaPointJournalier = z.object({
  jour: z.number().int().min(0),
  puissanceW: z.number(),
  batterieWh: z.number(),
  tamponGbit: z.number(),
  science: z.number(),
  scienceParObjectif: z.record(schemaId, z.number().nonnegative()).optional(),
  disponibilite: z.number().min(0).max(1).optional(),
  marges: z
    .object({
      batterie: z.number().min(0).max(1),
      stockage: z.number().min(0).max(1),
      deltaV: z.number().min(0).max(1),
      carburant: z.number().min(0).max(1),
    })
    .optional(),
  donneesGenereesGbit: z.number().nonnegative().optional(),
  donneesTransmisesGbit: z.number().nonnegative().optional(),
  donneesPerduesGbit: z.number().nonnegative().optional(),
});
export type PointJournalier = z.infer<typeof schemaPointJournalier>;

export const schemaProgressionScientifiqueObjectif = z.object({
  cumulee: z.number().nonnegative(),
  maximum: z.number().nonnegative(),
});
export type ProgressionScientifiqueObjectif = z.infer<typeof schemaProgressionScientifiqueObjectif>;

/** Événement appliqué pendant la simulation (HYPOTHESE Q-15 : attributs
 *  réduits à ce que la simulation applique ; `jour` remplace l'horloge, RG3). */
export const schemaEvenementApplique = z.object({
  id: schemaId,
  type: z.string().min(1),
  jour: z.number().int().min(0),
  origine: z.string().min(1),
  impact: schemaTypeConsequence,
  indice: z.string().min(1).optional(),
  cibleId: schemaId.optional(),
  ampleur: z.number().nonnegative().optional(),
});
export type EvenementApplique = z.infer<typeof schemaEvenementApplique>;

/** Les 5 options de crise (A9). */
export const schemaChoixCrise = z.enum([
  "desactiver-instrument",
  "reduire-transmissions",
  "suspendre-observations",
  "basse-consommation",
  "poursuivre",
]);
export type ChoixCrise = z.infer<typeof schemaChoixCrise>;

/** Décision de crise consignée (analyse §4.1 `DecisionCrise` : id, choix, date —
 *  la date est remplacée par le `jour` simulé pour rester déterministe, RG3). */
export const schemaDecisionCriseApp = z.object({
  id: schemaId,
  choix: schemaChoixCrise,
  jour: z.number().int().min(0),
  /** Instrument désactivé si `choix` = `desactiver-instrument`. */
  cibleId: schemaId.optional(),
});
export type DecisionCriseApp = z.infer<typeof schemaDecisionCriseApp>;

export const schemaCommandeSimulation = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("planifier-observation"),
    jour: z.number().int().positive(),
    instrumentId: schemaId,
    active: z.boolean(),
  }),
  z.object({
    type: z.literal("programmer-transmission"),
    jour: z.number().int().positive(),
    active: z.boolean(),
  }),
  z.object({
    type: z.literal("manoeuvre"),
    jour: z.number().int().positive(),
    deltaVms: z.number().positive(),
  }),
]);
export type CommandeSimulation = z.infer<typeof schemaCommandeSimulation>;

export const schemaOptionsDemarrageSimulation = z.object({
  missionId: schemaId,
  simulationId: schemaId,
  graine: z.number().int(),
  configuration: schemaConfigurationFigee,
  definitionsEvenements: z.array(schemaDefinitionEvenement),
});
export type OptionsDemarrageSimulation = z.infer<typeof schemaOptionsDemarrageSimulation>;

export const schemaResultatSimulation = z.object({
  version: z.number().int().positive(),
  simulationId: schemaId,
  graine: z.number().int(),
  dureeSimuleeJours: z.number().int().min(0),
  issue: schemaIssueSimulation,
  serie: z.array(schemaPointJournalier),
  evenements: z.array(schemaEvenementApplique),
  decisionsCrise: z.array(schemaDecisionCriseApp),
  sousSystemes: z.record(schemaId, schemaEtatSousSysteme),
  scienceCumulee: z.number(),
  scienceMax: z.number(),
  donneesPerduesGbit: z.number(),
  donneesGenereesGbit: z.number().nonnegative().optional(),
  donneesTransmisesGbit: z.number().nonnegative().optional(),
  carburantRestantKg: z.number(),
  progressionScientifiqueParObjectif: z
    .record(schemaId, schemaProgressionScientifiqueObjectif)
    .optional(),
});
export type ResultatSimulation = z.infer<typeof schemaResultatSimulation>;

export const schemaProgressionSimulation = z.object({
  jour: z.number().int().min(0),
  dureeCibleJours: z.number().int().positive(),
  batterieWh: z.number().nonnegative(),
  tamponGbit: z.number().nonnegative(),
  scienceCumulee: z.number().nonnegative(),
  terminee: z.boolean(),
});
export type ProgressionSimulation = z.infer<typeof schemaProgressionSimulation>;
