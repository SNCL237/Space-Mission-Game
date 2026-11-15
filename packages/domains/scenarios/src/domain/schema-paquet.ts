import { z } from "zod";
import {
  schemaDefinitionEvenement,
  schemaId,
  schemaPaquetScenario,
  schemaTexteBilingue,
  schemaTypeConsequence,
} from "@smdg/contracts";

// F2.9 : schéma **domaine** du paquet de scénario — sur-ensemble du contrat
// C2 (champs narratifs du cahier d'analyse §2.1/§5 : personnages, archives,
// événements narratifs, ordre de campagne). Le cœur C2 (`schemaPaquetScenario`)
// reste la source de vérité contractuelle ; ici on ne fait qu'**étendre**.

/** Personnage du paquet — toujours fictif (T2-14 : jamais confondu avec du réel). */
export const schemaPersonnage = z.object({
  id: schemaId,
  /** LUNAR-01 et les personnages sont fictifs (PLAN §1.4) : littéralement `true`. */
  fiction: z.literal(true),
  nom: schemaTexteBilingue,
  role: schemaTexteBilingue,
  motivation: schemaTexteBilingue,
});
export type Personnage = z.infer<typeof schemaPersonnage>;

/**
 * Archive du scénario (cahier d'analyse §5 : id, titre, contenu, conditionAcces).
 * HYPOTHESE (Q-19) : `realFact` xor `fiction` — un fait réel exige `source` +
 * `urlSource` https (RG12 transposé au récit, T2-14) ; LUNAR-01 porte
 * `fiction: true` (PLAN §1.4).
 */
export const schemaArchive = z
  .object({
    id: schemaId,
    titre: schemaTexteBilingue,
    contenu: schemaTexteBilingue,
    conditionAcces: z.string().min(1),
    realFact: z.boolean(),
    fiction: z.boolean(),
    source: z.string().min(1).optional(),
    urlSource: z.string().optional(),
  })
  .superRefine((archive, ctx) => {
    if (archive.realFact === archive.fiction) {
      ctx.addIssue({
        code: "custom",
        path: ["fiction"],
        message: "realFact et fiction sont exclusifs : exactement un des deux doit être vrai",
      });
    }
    if (archive.realFact) {
      if (archive.source === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["source"],
          message: "un fait réel (realFact) exige une source",
        });
      }
      if (archive.urlSource === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["urlSource"],
          message: "un fait réel (realFact) exige une urlSource https",
        });
      } else if (!archive.urlSource.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["urlSource"],
          message: "urlSource doit commencer par https://",
        });
      }
    }
  });
export type Archive = z.infer<typeof schemaArchive>;

/**
 * Événement narratif (cahier d'analyse §5 : id, declencheur, texte,
 * consequence). `consequence` n'accepte que les 4 types autorisés (RG5,
 * F2.7) — le schéma les refuse donc « par construction » (T2-13).
 */
export const schemaEvenementNarratif = z.object({
  id: schemaId,
  declencheur: z.string().min(1),
  texte: schemaTexteBilingue,
  consequence: schemaTypeConsequence,
});
export type EvenementNarratif = z.infer<typeof schemaEvenementNarratif>;

/** Définition d'événement C2 + marqueur `critique` (RG6, T2-12). */
export const schemaDefinitionEvenementSc = schemaDefinitionEvenement
  .extend({
    critique: z.boolean().optional(),
  })
  .superRefine((evenement, ctx) => {
    if (
      (evenement.impact === "instrument" || evenement.impact === "objectif") &&
      evenement.cibleId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["cibleId"],
        message: "un impact instrument ou objectif exige une cible",
      });
    }
    if (
      (evenement.impact === "donnees" || evenement.impact === "dureeVie") &&
      evenement.ampleur === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ampleur"],
        message: "un impact données ou durée de vie exige une ampleur",
      });
    }
  });

/** Paquet de scénario = C2 étendu (F2.9). */
export const schemaPaquetScenarioSc = schemaPaquetScenario.extend({
  /** Rang dans le catalogue ordonné de scénarios (déblocage A10, PLAN §2.1). */
  ordre: z.number().int().min(1),
  personnages: z.array(schemaPersonnage).min(1),
  archives: z.array(schemaArchive).min(1),
  evenementsNarratifs: z.array(schemaEvenementNarratif).min(1),
  definitionsEvenements: z.array(schemaDefinitionEvenementSc),
});
export type PaquetScenarioSc = z.output<typeof schemaPaquetScenarioSc>;
