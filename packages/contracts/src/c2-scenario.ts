import { z } from "zod";
import { schemaCodeFin, schemaId, schemaTexteBilingue, schemaTypeConsequence } from "./commun.js";

// Contrat C2 — PaquetScénario : SCE → CAM, CON, EVA (Agent.md §4).
// Champs racine repris de §6.1 : cible, budgetMaxMUSD, objectifs[],
// catalogueAutorise[], actes[7], definitionsEvenements[], fins[4] avec regles,
// conditionsDeblocage[] et version.

const schemaObjectifScientifique = z.object({
  id: schemaId,
  titre: z.string().min(1),
  questionScientifique: z.string().min(1),
  role: z.string().min(1),
});
export type ObjectifScientifique = z.infer<typeof schemaObjectifScientifique>;

/** Acte de la campagne (7 actes, 0 à VI ; A11). Textes bilingues (T2-11). */
export const schemaActe = z.object({
  id: schemaId,
  numero: z.number().int().min(0).max(6),
  titre: schemaTexteBilingue,
  type: z.string().min(1),
  description: schemaTexteBilingue,
});
export type Acte = z.infer<typeof schemaActe>;

/**
 * Définition d'un événement aléatoire (analyse §4.1).
 * `impact` porte les 4 types de conséquence autorisés (RG5, F2.7).
 * HYPOTHESE (Q-15) : `impact` = conséquence typée ; `indice` reste unique
 * (attribut `indice` de l'analyse ; RG6, T2-12).
 */
export const schemaDefinitionEvenement = z.object({
  id: schemaId,
  type: z.string().min(1),
  origine: z.string().min(1),
  probabilite: z.number().min(0).max(1),
  impact: schemaTypeConsequence,
  indice: z.string().min(1),
  cibleId: schemaId.optional(),
  ampleur: z.number().nonnegative().optional(),
});
export type DefinitionEvenement = z.infer<typeof schemaDefinitionEvenement>;

/**
 * Fin définie par le scénario (4 fins, A11).
 * HYPOTHESE (Q-13/Q-15) : la forme exacte des `regles` (A7 lit
 * « première règle satisfaite parmi A, B, C, D ») se fige en P5 avec EVA ;
 * on la transporte comme table de règles ouverte pour ne pas inventer.
 */
export const schemaFinDefinie = z.object({
  code: schemaCodeFin,
  titre: schemaTexteBilingue,
  regles: z.array(z.record(z.string(), z.unknown())),
  conclusion: schemaTexteBilingue,
});
export type FinDefinie = z.infer<typeof schemaFinDefinie>;

/**
 * Condition de déblocage (analyse §4.1 ; types décrits par A10).
 * Chaque `type` exige SA propre donnée (revue P1) : `{ type: "fin" }` sans
 * `finMinimale` est rejeté.
 */
export const schemaConditionDeblocage = z
  .object({
    id: schemaId,
    type: z.enum(["prerequis", "fin", "score"]),
    scenarioPrerequis: schemaId.optional(),
    finMinimale: schemaCodeFin.optional(),
    scoreMinimal: z.number().optional(),
  })
  .superRefine((condition, ctx) => {
    const attendu = {
      prerequis: ["scenarioPrerequis", condition.scenarioPrerequis] as const,
      fin: ["finMinimale", condition.finMinimale] as const,
      score: ["scoreMinimal", condition.scoreMinimal] as const,
    }[condition.type];
    if (attendu[1] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [attendu[0]],
        message: `Champ obligatoire pour une condition de type « ${condition.type} »`,
      });
    }
  });
export type ConditionDeblocage = z.infer<typeof schemaConditionDeblocage>;

export const schemaPaquetScenario = z.object({
  version: z.string().min(1),
  id: schemaId,
  /** Corps cible de la mission (ex. `lune`) — identifiant de code, pas de texte joueur. */
  cible: z.string().min(1),
  budgetMaxMUSD: z.number(),
  objectifs: z.array(schemaObjectifScientifique).min(1),
  catalogueAutorise: z.array(schemaId).min(1),
  actes: z.array(schemaActe).length(7),
  definitionsEvenements: z.array(schemaDefinitionEvenement),
  fins: z.array(schemaFinDefinie).length(4),
  conditionsDeblocage: z.array(schemaConditionDeblocage),
});
export type PaquetScenario = z.infer<typeof schemaPaquetScenario>;
