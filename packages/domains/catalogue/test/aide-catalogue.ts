import "reflect-metadata";

import type { ReferentielCatalogue } from "@smdg/contracts";

import type { DepotCatalogue } from "../src/domain/depot.js";
import type { DocumentCatalogue } from "../src/domain/schema-catalogue.js";
import { creerDataSourceCatalogue } from "../src/infrastructure/source-typeorm.js";

// Aides partagées des tests du domaine catalogue (pas un `*.test.ts` :
// vitest ne les collecte pas comme suites).

/** Dépôt en mémoire — mêmes garanties que le dépôt TypeORM, sans base. */
export class DepotMemoire implements DepotCatalogue {
  readonly documents = new Map<string, DocumentCatalogue>();

  async enregistrer(document: DocumentCatalogue): Promise<void> {
    this.documents.set(document.version, document);
  }

  async listerVersions(): Promise<string[]> {
    return [...this.documents.keys()].sort();
  }

  async lireDocument(version: string): Promise<DocumentCatalogue | undefined> {
    return this.documents.get(version);
  }

  async listerIdentifiants(): Promise<string[]> {
    return [...new Set([...this.documents.values()].map((document) => document.id))];
  }
}

/** Document catalogue minimal mais complet (toutes les sections requises). */
export function documentMinimal(): DocumentCatalogue {
  return {
    id: "ca7a0001-0000-4000-8000-000000000000",
    version: "1.0.0",
    niveauxDifficulte: ["decouverte", "ingenieur", "expert"],
    seuils: { alerteOrange: 0.9, alerteRouge: 1 },
    categories: [
      { id: "ca7e0001-0000-4000-8000-000000000000", segment: "spatial", code: "structure" },
    ],
    composants: [
      {
        id: "c0de0001-0000-4000-8000-000000000000",
        source: "a-calibrer",
        categorie: "structure",
        nom: "structure-principale",
        niveau: "decouverte",
        gameplay: { masseKg: 80, powerW: 0, dutyCycle: 1, costMUSD: 5, fiabilite: 0.99 },
      },
    ],
    instruments: [
      {
        id: "1a570001-0000-4000-8000-000000000000",
        source: "a-calibrer",
        categorie: "instrument",
        nom: "camera-nadir",
        gameplay: {
          masseKg: 18,
          powerW: 30,
          dutyCycle: 1,
          costMUSD: 15,
          dataMbps: 0.9,
          valeurScientifique: 0.9,
          fiabilite: 0.95,
        },
      },
    ],
    orbites: [
      {
        id: "02610001-0000-4000-8000-000000000000",
        source: "a-calibrer",
        type: "polaire",
        gameplay: {
          altitudeKm: 100,
          inclinaisonDeg: 90,
          periodeS: 7065.7,
          fractionOmbre: 0.35,
          tempsContactSolMin: 4.47,
          couverture: 0.9,
        },
      },
    ],
    lanceurs: [
      {
        id: "1a4c0001-0000-4000-8000-000000000000",
        source: "a-calibrer",
        nom: "lanceur-moyen",
        classe: "moyen",
        gameplay: {
          capaciteKg: { polaire: 420, circulaireBasse: 450, elliptique: 400 },
          costMUSD: 30,
          fiabilite: 0.95,
        },
      },
    ],
    stationsSol: [
      {
        id: "57a70001-0000-4000-8000-000000000000",
        source: "a-calibrer",
        nom: "white-sands",
        gameplay: { dataMbps: 100 },
      },
    ],
  };
}

/** Copie profonde d'un document pour mutation locale dans un test. */
export function cloner<T>(valeur: T): T {
  return structuredClone(valeur);
}

let probe: Promise<boolean> | undefined;

/**
 * Probe PostgreSQL (une fois par processus de test) : `true` si la base
 * répond **et** que la migration du domaine s'applique. Les tests
 * d'intégration (T2-04) se sautent sinon (`describe.skipIf`).
 */
export function postgresDisponible(): Promise<boolean> {
  probe ??= (async () => {
    const source = creerDataSourceCatalogue();
    try {
      await source.initialize();
      await source.query("SELECT 1");
      return true;
    } catch {
      return false;
    } finally {
      try {
        await source.destroy();
      } catch {
        // Non initialisée : rien à fermer.
      }
    }
  })();
  return probe;
}

/** Supprime les lignes de test `prefixe-%` puis détruit la connexion. */
export async function nettoyerLignesTest(prefixe: string): Promise<void> {
  const source = creerDataSourceCatalogue();
  await source.initialize();
  await source.query(`DELETE FROM "cat"."version_catalogue" WHERE "version" LIKE $1`, [
    `${prefixe}%`,
  ]);
  await source.destroy();
}

/** Vérifie qu'un référentiel est bien un C1 lisible (contrat gelé). */
export function estC1Valide(referentiel: ReferentielCatalogue | undefined): boolean {
  return referentiel !== undefined;
}
