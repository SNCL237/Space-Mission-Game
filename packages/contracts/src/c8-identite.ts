import { z } from "zod";
import { schemaId, schemaLangue } from "./commun.js";

// Contrat C8 — IdentitéUtilisateur : IDE → tous (Agent.md §4).
// « Identifiant et langue (seule donnée partagée) ».

export const schemaIdentiteUtilisateur = z.object({
  version: z.number().int().positive(),
  id: schemaId,
  langue: schemaLangue,
});
export type IdentiteUtilisateur = z.infer<typeof schemaIdentiteUtilisateur>;
