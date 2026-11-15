import { z } from "zod";

import { schemaId } from "./commun.js";

export const schemaPositionVue = z.object({
  xKm: z.number(),
  yKm: z.number(),
  zKm: z.number(),
});

export const schemaPointTrajectoireVue = z.object({
  tempsS: z.number().nonnegative(),
  positionKm: schemaPositionVue,
});

export const schemaVueMission = z.object({
  version: z.literal(1),
  concept: z.object({
    missionId: schemaId,
    scenarioId: schemaId,
    cible: z.string().min(1),
    objectifs: z.array(
      z.object({
        id: schemaId,
        titre: z.string().min(1),
        role: z.string().min(1),
      }),
    ),
  }),
  trajectoires: z.object({
    referentiel: z.literal("lune-centre-inertiel"),
    orbite: z.object({
      altitudeKm: z.number().positive(),
      inclinaisonDeg: z.number().min(0).max(180),
      periodeS: z.number().positive(),
    }),
    positions: z.array(schemaPointTrajectoireVue).min(2),
  }),
  chronologie: z.array(
    z.object({
      id: schemaId,
      date: z.string().datetime(),
      acte: z.number().int().min(0).max(6),
      segment: z.enum(["lancement", "spatial", "sol", "utilisateurs"]),
      code: z.string().min(1),
    }),
  ),
  scene3d: z.object({
    corpsCeleste: z.object({
      nom: z.string().min(1),
      rayonKm: z.number().positive(),
    }),
    engin: z.object({
      id: schemaId,
      trajectoireId: z.string().min(1),
    }),
  }),
  notesModele: z.array(z.string().min(1)),
});

export type VueMission = z.infer<typeof schemaVueMission>;
