import "reflect-metadata";

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { schemaPaquetScenario } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { DepotScenariosTypeorm } from "../src/infrastructure/depot-typeorm-paquets.js";
import {
  chargerPaquetsDepuisDisque,
  resoudreDossierScenarios,
} from "../src/infrastructure/source-donnees.js";
import { creerDataSourceScenarios } from "../src/infrastructure/source-typeorm.js";
import { ValiderPaquet } from "../src/application/valider-paquet.js";
import {
  DepotMemoireScenarios,
  cloner,
  contexteValide,
  fauxPortCatalogue,
  paquetLunaire,
  postgresDisponible,
} from "./aide-scenarios.js";

// T2-15 : le chargeur découvre les paquets **sans aucune connaissance codée**
// — ajouter un scénario = ajouter `data/<scenario>/paquet.json`, zéro
// changement de code (Agent.md §6). Le test vérifie aussi que les identifiants
// des scénarios n'apparaissent dans aucun fichier source. Partie PostgreSQL :
// import idempotent du dépôt (PT1, schéma `sce`) + relecture C2.

/** Tous les `.ts` de `src/` (lecture directe : pas d'import interdit, RI1). */
function sourcesScenarios(): { fichier: string; contenu: string }[] {
  const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const fichiers: string[] = [];
  const parcours = (dossier: string): void => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcours(chemin);
      else if (nom.endsWith(".ts")) fichiers.push(chemin);
    }
  };
  parcours(racine);
  return fichiers.map((fichier) => ({ fichier, contenu: readFileSync(fichier, "utf8") }));
}

describe("scénarios — découverte des paquets du disque (T2-15)", () => {
  it("T2-15 : data/ contient un paquet par scénario ; ids uniques et absents de tout le code source", () => {
    const dossier = resoudreDossierScenarios();
    const attendus = readdirSync(dossier)
      .filter((nom) => statSync(join(dossier, nom)).isDirectory())
      .filter((nom) => existsSync(join(dossier, nom, "paquet.json")))
      .sort();
    // Le scénario lunaire est livré en P2 ; le second arrive en JSON seul.
    expect(attendus.length).toBeGreaterThanOrEqual(1);

    const paquets = chargerPaquetsDepuisDisque();
    expect(paquets.map((paquet) => paquet.fichier)).toEqual(
      attendus.map((nom) => `${nom}/paquet.json`),
    );

    const identifiants = paquets.map((paquet) => (paquet.brut as { id: string }).id);
    expect(identifiants.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(identifiants).size).toBe(identifiants.length);

    // Aucun identifiant de scénario n'est référencé dans `src/` : la découverte
    // est intégralement pilotée par le disque — ajouter un scénario ne peut pas
    // exiger une modification de code (T2-15).
    const sources = sourcesScenarios();
    expect(sources.length).toBeGreaterThan(0);
    for (const identifiant of identifiants) {
      for (const source of sources) {
        expect(source.contenu, `${identifiant} présent dans ${source.fichier}`).not.toContain(
          identifiant,
        );
      }
    }
  });
});

const pg = await postgresDisponible();

describe.skipIf(!pg)("scénarios — import TypeORM (T2-15, PostgreSQL)", () => {
  const SCENARIO_TEST = "5ce4fffe-0000-4000-8000-000000000000";

  async function nettoyer(): Promise<void> {
    const source = creerDataSourceScenarios();
    await source.initialize();
    await source.query(`DELETE FROM "sce"."paquet_scenario" WHERE "scenario_id" = $1`, [
      SCENARIO_TEST,
    ]);
    await source.destroy();
  }

  it("T2-15 : ré-import sans doublon ; le paquet relu reste un C2 valide", async () => {
    await nettoyer();
    try {
      const depot = new DepotScenariosTypeorm();
      const paquet = cloner(paquetLunaire());
      paquet.id = SCENARIO_TEST;
      paquet.version = "t2-15-a";

      // A11 vert puis double enregistrement : une seule ligne en base.
      const valider = new ValiderPaquet(
        fauxPortCatalogue(contexteValide().identifiantsCatalogue),
        depot,
      );
      expect((await valider.valider(paquet)).valide).toBe(true);
      await depot.enregistrer(paquet);
      await depot.enregistrer(paquet);

      const source = creerDataSourceScenarios();
      await source.initialize();
      const lignes = await source.query<{ n: string }[]>(
        `SELECT count(*)::text AS n FROM "sce"."paquet_scenario" WHERE "scenario_id" = $1`,
        [SCENARIO_TEST],
      );
      await source.destroy();
      expect(lignes[0]?.n).toBe("1");

      // Contexte A11 et relecture : le paquet stocké reste un C2 lisible.
      expect(await depot.listerIds()).toContain(SCENARIO_TEST);
      expect(await depot.listerSituations()).toContainEqual({
        id: SCENARIO_TEST,
        prerequis: [],
      });
      const relu = await depot.lire(SCENARIO_TEST, "t2-15-a");
      expect(relu).toBeDefined();
      expect(schemaPaquetScenario.safeParse(relu).success).toBe(true);
      expect(await depot.lire(SCENARIO_TEST, "version-inconnue")).toBeUndefined();
    } finally {
      await nettoyer();
    }
  });
});

// Garde-fou : le dépôt mémoire reste couvert même sans base (même contrat).
describe("scénarios — dépôt mémoire", () => {
  it("T2-15 (mémoire) : enregistrement, ids et situations", async () => {
    const depot = new DepotMemoireScenarios();
    const paquet = paquetLunaire();
    await depot.enregistrer(paquet);
    await depot.enregistrer(paquet);
    expect(depot.paquets.size).toBe(1);
    expect(await depot.listerIds()).toEqual([paquet.id]);
    expect(await depot.listerSituations()).toEqual([{ id: paquet.id, prerequis: [] }]);
    expect(await depot.lire(paquet.id, paquet.version)).toEqual(paquet);
  });
});
