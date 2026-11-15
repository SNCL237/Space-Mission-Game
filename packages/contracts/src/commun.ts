import { z } from "zod";

/** UUID v4 : format exact des identifiants de domaine (`Id` de `@smdg/kernel`). */
export const schemaId = z.uuidv4();

/** Langues supportées (Agent.md §8 : textes fr/en produits par PED). */
export const schemaLangue = z.enum(["fr", "en"]);
export type Langue = z.infer<typeof schemaLangue>;

/** Texte bilingue porté par les paquets de scénarios (jamais par le code, RI7). */
export const schemaTexteBilingue = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
});
export type TexteBilingue = z.infer<typeof schemaTexteBilingue>;

/**
 * Types d'orbite du catalogue (Agent.md §9 : polaire, circulaire basse, elliptique).
 * HYPOTHESE (Q-15) : valeurs d'enum à confirmer avec le catalogue de P2.
 */
export const schemaOrbiteType = z.enum(["polaire", "circulaireBasse", "elliptique"]);
export type OrbiteType = z.infer<typeof schemaOrbiteType>;

/**
 * Niveaux de difficulté / de catalogue (Agent.md §7 : trois niveaux inspirés du jeu
 * sur les télescopes ; voir Q-09).
 */
export const schemaDifficulte = z.enum(["decouverte", "ingenieur", "expert"]);
export type Difficulte = z.infer<typeof schemaDifficulte>;

/** Codes des quatre fins (RG4 ; seuils configurables, Q-13). */
export const schemaCodeFin = z.enum(["A", "B", "C", "D"]);
export type CodeFin = z.infer<typeof schemaCodeFin>;

/** États d'un sous-système (cahier d'analyse §4.1, SIM). */
export const schemaEtatSousSysteme = z.enum(["operationnel", "degrade", "critique", "horsLigne"]);
export type EtatSousSysteme = z.infer<typeof schemaEtatSousSysteme>;

/** Issue d'une simulation (cahier de conception §6.1, C4). */
export const schemaIssueSimulation = z.enum(["nominale", "ecourtee", "perdue"]);
export type IssueSimulation = z.infer<typeof schemaIssueSimulation>;

/** Les quatre types de conséquence autorisés (RG5, jamais autre chose). */
export const schemaTypeConsequence = z.enum(["instrument", "donnees", "objectif", "dureeVie"]);
export type TypeConsequence = z.infer<typeof schemaTypeConsequence>;
