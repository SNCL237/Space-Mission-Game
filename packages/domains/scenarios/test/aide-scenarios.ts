import "reflect-metadata";

import type { PortCatalogue, ReferentielCatalogue } from "@smdg/contracts";

import type { DepotScenarios, SituationScenario } from "../src/domain/depot.js";
import { schemaPaquetScenarioSc, type PaquetScenarioSc } from "../src/domain/schema-paquet.js";
import { chargerPaquetsDepuisDisque } from "../src/infrastructure/source-donnees.js";
import { creerDataSourceScenarios } from "../src/infrastructure/source-typeorm.js";

// Aides partagées des tests du domaine scénarios (pas un `*.test.ts` :
// vitest ne les collecte pas comme suites).

/** Identifiant du document catalogue de `catalogue/data/meta.json` (A11). */
export const IDENTIFIANT_CATALOGUE_LUNE = "ca7a0001-0000-4000-8000-000000000000";

/** Dépôt en mémoire — mêmes garanties que le dépôt TypeORM, sans base. */
export class DepotMemoireScenarios implements DepotScenarios {
  readonly paquets = new Map<string, PaquetScenarioSc>();

  async enregistrer(paquet: PaquetScenarioSc): Promise<void> {
    this.paquets.set(`${paquet.id}|${paquet.version}`, paquet);
  }

  async listerIds(): Promise<string[]> {
    return [...new Set([...this.paquets.values()].map((paquet) => paquet.id))].sort();
  }

  async listerSituations(): Promise<SituationScenario[]> {
    const vus = new Set<string>();
    const situations: SituationScenario[] = [];
    for (const paquet of this.paquets.values()) {
      if (vus.has(paquet.id)) continue;
      vus.add(paquet.id);
      situations.push({
        id: paquet.id,
        prerequis: paquet.conditionsDeblocage
          .filter((condition) => condition.type === "prerequis")
          .map((condition) => condition.scenarioPrerequis as string),
      });
    }
    return situations.sort((a, b) => a.id.localeCompare(b.id));
  }

  async lire(scenarioId: string, version: string): Promise<PaquetScenarioSc | undefined> {
    return this.paquets.get(`${scenarioId}|${version}`);
  }
}

/** Port catalogue factice : A11 ne demande qu'une liste d'identifiants. */
export function fauxPortCatalogue(identifiants: readonly string[] = []): PortCatalogue {
  return {
    async listerVersions(): Promise<string[]> {
      return ["1.0.0"];
    },
    async lire(_version: string): Promise<ReferentielCatalogue | undefined> {
      return undefined;
    },
    async listerIdentifiants(): Promise<string[]> {
      return [...identifiants];
    },
  };
}

/** Contexte A11 d'un paquet valide : le catalogue de LUNE est connu. */
export function contexteValide(): {
  identifiantsCatalogue: string[];
  scenariosConnus: SituationScenario[];
} {
  return { identifiantsCatalogue: [IDENTIFIANT_CATALOGUE_LUNE], scenariosConnus: [] };
}

/** Copie profonde d'un paquet pour mutation locale dans un test. */
export function cloner<T>(valeur: T): T {
  return structuredClone(valeur);
}

/** Tous les paquets du disque, validés (lève si l'un d'eux est invalide). */
export function paquetsDisques(): PaquetScenarioSc[] {
  return chargerPaquetsDepuisDisque().map(({ fichier, brut }) => {
    const parse = schemaPaquetScenarioSc.safeParse(brut);
    if (!parse.success) {
      throw new Error(`${fichier} invalide : ${parse.error.issues[0]?.message ?? ""}`);
    }
    return parse.data;
  });
}

/** Le paquet lunaire (LUNAR-01, `ordre` 1) — celui de référence en P2. */
export function paquetLunaire(): PaquetScenarioSc {
  const paquet = paquetsDisques().find((candidate) => candidate.id.startsWith("5ce40001-"));
  if (paquet === undefined) throw new Error("paquet lunaire absent de data/");
  return paquet;
}

let probe: Promise<boolean> | undefined;

/**
 * Probe PostgreSQL (une fois par processus de test) : `true` si la base
 * répond **et** que la migration du domaine s'applique. Les tests
 * d'intégration se sautent sinon (`describe.skipIf`).
 */
export function postgresDisponible(): Promise<boolean> {
  probe ??= (async () => {
    const source = creerDataSourceScenarios();
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
