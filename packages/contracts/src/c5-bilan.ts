import { z } from "zod";
import { schemaCodeFin, schemaId } from "./commun.js";
import { schemaCodeExplication } from "./c7-code.js";
import { schemaConfigurationFigee } from "./c3-configuration.js";
import { schemaResultatSimulation } from "./c4-simulation.js";

// C5 v1 remains readable. V2 makes the solo/team scoring mode explicit.

const schemaChampsBilan = {
  missionRef: schemaId,
  scoreTotal: z.number().min(0).max(1000),
  fin: schemaCodeFin,
  causes: z.array(schemaCodeExplication),
  decisionsCles: z.array(schemaId),
};

const schemaBilanMissionV1 = z.object({
  version: z.literal(1),
  ...schemaChampsBilan,
  recommandations: z.array(schemaCodeExplication),
  scores: z.object({
    science: z.number().min(0).max(300),
    technique: z.number().min(0).max(250),
    ressources: z.number().min(0).max(200),
    fiabilite: z.number().min(0).max(150),
    collab: z.number().min(0).max(100),
  }),
});

const schemaScoresEquipe = z.object({
  science: z.number().min(0).max(300),
  technique: z.number().min(0).max(250),
  ressources: z.number().min(0).max(200),
  fiabilite: z.number().min(0).max(150),
  collab: z.number().min(0).max(100),
});

const schemaScoresSolo = z.object({
  science: z
    .number()
    .min(0)
    .max((300 * 1000) / 900),
  technique: z
    .number()
    .min(0)
    .max((250 * 1000) / 900),
  ressources: z
    .number()
    .min(0)
    .max((200 * 1000) / 900),
  fiabilite: z
    .number()
    .min(0)
    .max((150 * 1000) / 900),
  collab: z.literal(0),
});

export const schemaRecommandation = z.object({
  pourquoi: schemaCodeExplication,
  piste: schemaCodeExplication,
});
export type Recommandation = z.infer<typeof schemaRecommandation>;

const schemaBilanMissionV2 = z.discriminatedUnion("mode", [
  z.object({
    version: z.literal(2),
    ...schemaChampsBilan,
    mode: z.literal("solo"),
    scores: schemaScoresSolo,
    recommandations: z.array(schemaRecommandation),
  }),
  z.object({
    version: z.literal(2),
    ...schemaChampsBilan,
    mode: z.literal("equipe"),
    scores: schemaScoresEquipe,
    recommandations: z.array(schemaRecommandation),
  }),
]);

export const schemaBilanMission = z
  .union([schemaBilanMissionV1, schemaBilanMissionV2])
  .superRefine((bilan, ctx) => {
    if (bilan.version !== 2) return;
    const somme = Object.values(bilan.scores).reduce((total, score) => total + score, 0);
    if (Math.abs(somme - bilan.scoreTotal) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["scoreTotal"],
        message: "scoreTotal doit être égal à la somme des composantes",
      });
    }
  });
export type BilanMission = z.infer<typeof schemaBilanMission>;

export const schemaRapportMission = z.object({
  version: z.literal(1),
  bilan: schemaBilanMission,
  configuration: schemaConfigurationFigee,
  resultat: schemaResultatSimulation,
  chronologie: z.array(
    z.object({
      jour: z.number().int().nonnegative(),
      type: z.enum(["evenement", "decision"]),
      reference: schemaId,
      code: z.string().min(1),
    }),
  ),
  leconsApprises: z.array(schemaRecommandation),
  rejouer: z.boolean(),
  missionsReellesComparables: z.array(z.string().min(1)).min(1).optional(),
});
export type RapportMission = z.infer<typeof schemaRapportMission>;
