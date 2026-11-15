import { z } from "zod";
import {
  schemaDifficulte,
  schemaId,
  schemaOrbiteType,
  schemaSeuilsCatalogue,
} from "@smdg/contracts";

import {
  DOMAINES_ACCEPTES_DEFAUT,
  SOURCE_A_CALIBRER,
  estSourceReelle,
  problemeSource,
  type ReglesSource,
} from "./sources.js";

// F2.1 (RG12, BF36) : schéma **domaine** du catalogue JSON — sur-ensemble du
// contrat C1 (blocs `gameplay`/`reference`, table des catégories sur les 4
// segments du *Design and Develop Science Missions*, niveaux, missions
// réelles). La projection C1 vit dans `projection.ts` ; le schéma gelé C1
// reste inchangé sauf pour `capaciteKg` partiel (Q-17).

/** Segments du *Design and Develop Science Missions* (table des catégories). */
export const SEGMENTS_CATALOGUE = ["lancement", "spatial", "sol", "utilisateurs"] as const;
export type SegmentCatalogue = (typeof SEGMENTS_CATALOGUE)[number];

/** Options de construction du schéma (liste de domaines configurable, T2-02). */
export interface OptionsSchemaCatalogue {
  readonly domainesAcceptes?: readonly string[];
}

/**
 * Contrôle RG12 posé sur un bloc `source`/`urlSource` quelconque (entrée ou
 * `reference`) et ajoute l'issue Zod correspondante si besoin.
 */
function ajouterProblemeSource(
  ctx: z.RefinementCtx,
  chemin: readonly (string | number)[],
  source: string,
  urlSource: string | undefined,
  regles: ReglesSource,
): void {
  const probleme = problemeSource(source, urlSource, regles);
  if (probleme !== undefined) {
    ctx.addIssue({ code: "custom", path: [...chemin], message: probleme });
  }
}

/**
 * Construit le schéma du document catalogue. `domainesAcceptes` rend la
 * liste des domaines de référence configurable (T2-02) ; défaut : constante
 * `DOMAINES_ACCEPTES_DEFAUT`.
 */
export function construireSchemaCatalogue(options: OptionsSchemaCatalogue = {}) {
  const regles: ReglesSource = {
    domainesAcceptes: options.domainesAcceptes ?? DOMAINES_ACCEPTES_DEFAUT,
  };

  /** Bloc documenté (RG12) : masses/puissances réelles + provenance. */
  const schemaBlocReference = z
    .object({
      source: z.string().min(1),
      urlSource: z.url().optional(),
      masseKg: z.number().optional(),
      powerW: z.number().optional(),
    })
    .superRefine((bloc, ctx) =>
      ajouterProblemeSource(ctx, ["urlSource"], bloc.source, bloc.urlSource, regles),
    );

  /** Champs communs à toute entrée du catalogue (source obligatoire, T2-01). */
  const champsEntree = {
    id: schemaId,
    /** « a-calibrer » sinon — obligatoire : un élément sans `source` échoue (T2-01). */
    source: z.string().min(1),
    urlSource: z.url().optional(),
    reference: schemaBlocReference.optional(),
    /** Missions réelles seulement si une source réelle est présente (RG12). */
    missionsReelles: z.array(z.string().min(1)).optional(),
    incompatiblesAvec: z.array(z.string().min(1)).optional(),
  } as const;

  /**
   * Règles d'entrée : RG12 sur `source`/`urlSource` de l'entrée, et
   * `missionsReelles` réservé aux entrées portant une source réelle.
   */
  function reglesEntree(
    entree: {
      source: string;
      urlSource?: string | undefined;
      reference?: { source: string; urlSource?: string | undefined } | undefined;
      missionsReelles?: readonly string[] | undefined;
    },
    ctx: z.RefinementCtx,
  ): void {
    ajouterProblemeSource(ctx, ["urlSource"], entree.source, entree.urlSource, regles);
    const sourceReelle =
      estSourceReelle(entree.source) ||
      (entree.reference !== undefined && estSourceReelle(entree.reference.source));
    if (
      entree.missionsReelles !== undefined &&
      entree.missionsReelles.length > 0 &&
      !sourceReelle
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["missionsReelles"],
        message: `missionsReelles exige une source réelle (entrée ou reference) — « ${SOURCE_A_CALIBRER} » seul ne suffit pas`,
      });
    }
  }

  const schemaCategorie = z.object({
    id: schemaId,
    segment: z.enum(SEGMENTS_CATALOGUE),
    code: z.string().min(1),
  });

  const schemaComposant = z
    .object({
      ...champsEntree,
      categorie: z.string().min(1),
      nom: z.string().min(1),
      niveau: schemaDifficulte,
      gameplay: z.object({
        masseKg: z.number(),
        powerW: z.number(),
        dutyCycle: z.number().min(0).max(1),
        capaciteBatterieWh: z.number().positive().optional(),
        ispS: z.number().positive().optional(),
        degradationAn: z.number().min(0).max(1).optional(),
        costMUSD: z.number(),
        fiabilite: z.number().min(0).max(1),
      }),
    })
    .superRefine(reglesEntree);

  const schemaInstrument = z
    .object({
      ...champsEntree,
      categorie: z.string().min(1),
      nom: z.string().min(1),
      gameplay: z.object({
        masseKg: z.number(),
        powerW: z.number(),
        dutyCycle: z.number().min(0).max(1),
        costMUSD: z.number(),
        dataMbps: z.number().min(0),
        valeurScientifique: z.number().min(0),
        fiabilite: z.number().min(0).max(1),
      }),
      incompatiblesAvec: z.array(z.string().min(1)).optional(),
    })
    .superRefine(reglesEntree);

  const schemaOrbite = z
    .object({
      ...champsEntree,
      type: schemaOrbiteType,
      gameplay: z.object({
        altitudeKm: z.number().min(0),
        inclinaisonDeg: z.number(),
        // HYPOTHESE (Q-15) : pour l'orbite elliptique, `altitudeKm` = périgée
        // (C1 ne porte qu'une seule altitude).
        periodeS: z.number().positive(),
        fractionOmbre: z.number().min(0).max(1),
        tempsContactSolMin: z.number().min(0),
        couverture: z.number().min(0).max(1),
      }),
    })
    .superRefine(reglesEntree);

  const schemaLanceur = z
    .object({
      ...champsEntree,
      nom: z.string().min(1),
      classe: z.enum(["leger", "moyen", "lourd"]),
      gameplay: z.object({
        // Table partielle (A2, Q-17) : seules les orbites desservies sont déclarées.
        capaciteKg: z.partialRecord(schemaOrbiteType, z.number()),
        costMUSD: z.number(),
        fiabilite: z.number().min(0).max(1),
      }),
    })
    .superRefine(reglesEntree);

  const schemaStationSol = z
    .object({
      ...champsEntree,
      nom: z.string().min(1),
      gameplay: z.object({
        dataMbps: z.number().min(0),
      }),
    })
    .superRefine(reglesEntree);

  return z.object({
    /** Identifiant UUID du document — cible de `catalogueAutorise` (C2, A11). */
    id: schemaId,
    version: z.string().min(1),
    categories: z.array(schemaCategorie).min(1),
    niveauxDifficulte: z.array(schemaDifficulte).min(1),
    composants: z.array(schemaComposant).min(1),
    instruments: z.array(schemaInstrument).min(1),
    orbites: z.array(schemaOrbite).min(1),
    lanceurs: z.array(schemaLanceur).min(1),
    stationsSol: z.array(schemaStationSol).min(1),
    seuils: schemaSeuilsCatalogue,
  });
}

/** Schéma du document catalogue avec les règles par défaut. */
export const schemaCatalogue = construireSchemaCatalogue();

/** Type du document catalogue (supplémentaire à C1, produit par CAT). */
export type DocumentCatalogue = z.output<typeof schemaCatalogue>;
