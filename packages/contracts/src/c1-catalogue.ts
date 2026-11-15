import { z } from "zod";
import { schemaDifficulte, schemaId, schemaOrbiteType } from "./commun.js";

// Contrat C1 — RéférentielCatalogue : CAT → CON, SCE (Agent.md §4).
// HYPOTHESE (Q-15) : §6.1 ne détaille pas C1 ; on suit les entités de
// l'analyse §4.1 (attributs) + le bloc `source`/`urlSource` (RG12). Le schéma
// exact du catalogue JSON se fige en P2 (F2.1) ; toute évolution incompatible
// bump `version`.

const schemaEntreeCatalogue = z.object({
  id: schemaId,
  /** « a-calibrer » sinon (Agent.md §0.2). */
  source: z.string().min(1),
  urlSource: z.url().optional(),
});

export const schemaComposantCatalogue = schemaEntreeCatalogue.extend({
  categorie: z.string().min(1),
  nom: z.string().min(1),
  masseKg: z.number(),
  powerW: z.number(),
  dutyCycle: z.number().min(0).max(1).optional(),
  capaciteBatterieWh: z.number().positive().optional(),
  ispS: z.number().positive().optional(),
  degradationAn: z.number().min(0).max(1).optional(),
  costMUSD: z.number(),
  fiabilite: z.number().min(0).max(1),
  niveau: schemaDifficulte,
});
export type ComposantCatalogue = z.infer<typeof schemaComposantCatalogue>;

export const schemaInstrumentCatalogue = schemaEntreeCatalogue.extend({
  nom: z.string().min(1),
  missionsReelles: z.array(z.string().min(1)).optional(),
  masseKg: z.number(),
  powerW: z.number(),
  dutyCycle: z.number().min(0).max(1).optional(),
  incompatiblesAvec: z.array(z.string().min(1)).optional(),
  costMUSD: z.number(),
  dataMbps: z.number(),
  valeurScientifique: z.number(),
  fiabilite: z.number().min(0).max(1),
});
export type InstrumentCatalogue = z.infer<typeof schemaInstrumentCatalogue>;

export const schemaOrbiteCatalogue = schemaEntreeCatalogue.extend({
  type: schemaOrbiteType,
  altitudeKm: z.number(),
  inclinaisonDeg: z.number(),
  periodeS: z.number(),
  fractionOmbre: z.number().min(0).max(1),
  tempsContactSolMin: z.number(),
  couverture: z.number().min(0).max(1),
});
export type OrbiteCatalogue = z.infer<typeof schemaOrbiteCatalogue>;

export const schemaLanceurCatalogue = schemaEntreeCatalogue.extend({
  nom: z.string().min(1),
  classe: z.enum(["leger", "moyen", "lourd"]),
  /**
   * Table des capacités par type d'orbite (A2 ; la C3 garde la valeur résolue, Q-14).
   * HYPOTHESE (Q-17) : record **partiel** — un lanceur ne déclare que les orbites
   * qu'il dessert (A2 : `orbite.type ∉ lanceur.capaciteKg` ⇒ `ORBITE_INACCESSIBLE`).
   * `z.record` (énum) était exhaustif en zod 4.6 et rendait A2 inatteignable ;
   * changement de contrat assumé, instantané T1-03 mis à jour consciemment.
   */
  capaciteKg: z.partialRecord(schemaOrbiteType, z.number()),
  costMUSD: z.number(),
  fiabilite: z.number().min(0).max(1),
});
export type LanceurCatalogue = z.infer<typeof schemaLanceurCatalogue>;

export const schemaStationSolCatalogue = schemaEntreeCatalogue.extend({
  nom: z.string().min(1),
  dataMbps: z.number(),
});
export type StationSolCatalogue = z.infer<typeof schemaStationSolCatalogue>;

/** Seuils d'alerte du catalogue (CAT possède les seuils, Agent.md §3.2). */
export const schemaSeuilsCatalogue = z.record(z.string(), z.number());

export const schemaReferentielCatalogue = z.object({
  version: z.string().min(1),
  composants: z.array(schemaComposantCatalogue),
  instruments: z.array(schemaInstrumentCatalogue),
  orbites: z.array(schemaOrbiteCatalogue),
  lanceurs: z.array(schemaLanceurCatalogue),
  stationsSol: z.array(schemaStationSolCatalogue),
  seuils: schemaSeuilsCatalogue,
});
export type ReferentielCatalogue = z.infer<typeof schemaReferentielCatalogue>;
