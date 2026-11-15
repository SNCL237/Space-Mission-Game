import { z } from "zod";
import { schemaId } from "./commun.js";

// Contrat C6 — DécisionÉquipe : EQU → CON (Agent.md §4).
// « Commande « appliquer ce changement » après vote » (A8).
// HYPOTHESE (Q-15) : la forme de `delta` n'est pas spécifiée (EQU est V2, P10) ;
// on la transporte comme table ouverte plutôt que d'inventer un format.

export const schemaDecisionEquipe = z.object({
  version: z.number().int().positive(),
  propositionId: schemaId,
  missionId: schemaId,
  /** Changement accepté par vote, à appliquer par CON. */
  delta: z.record(z.string(), z.unknown()),
});
export type DecisionEquipe = z.infer<typeof schemaDecisionEquipe>;
