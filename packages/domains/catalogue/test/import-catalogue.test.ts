import "reflect-metadata";

import { schemaReferentielCatalogue } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ImporterCatalogue } from "../src/application/importer-catalogue.js";
import { DepotCatalogueTypeorm } from "../src/infrastructure/depot-typeorm-catalogue.js";
import {
  DepotMemoire,
  cloner,
  documentMinimal,
  nettoyerLignesTest,
  postgresDisponible,
} from "./aide-catalogue.js";

// T2-04 : import idempotent en base réelle (PT1, schéma `cat`). Le test se
// saute sans PostgreSQL — les garanties d'idempotence restent couvertes par
// le dépôt mémoire ci-dessous (même contrat).

const pg = await postgresDisponible();

describe("catalogue — import idempotent (dépôt mémoire)", () => {
  it("T2-04 (mémoire) : ré-import d'une même version sans doublon", async () => {
    const depot = new DepotMemoire();
    const importateur = new ImporterCatalogue(depot);
    const document = documentMinimal();

    expect((await importateur.importer(cloner(document))).importe).toBe(true);
    expect((await importateur.importer(cloner(document))).importe).toBe(true);
    expect(await depot.listerVersions()).toEqual(["1.0.0"]);
    expect(depot.documents.size).toBe(1);
  });
});

describe.skipIf(!pg)("catalogue — import TypeORM (T2-04, PostgreSQL)", () => {
  it("T2-04 : importer deux fois la même version → aucun doublon ; nouvelle version → ancienne lisible via C1", async () => {
    await nettoyerLignesTest("t2-04-");
    try {
      const depot = new DepotCatalogueTypeorm();
      const importateur = new ImporterCatalogue(depot);
      const premier = cloner(documentMinimal());
      premier.version = "t2-04-a";
      const deuxieme = cloner(documentMinimal());
      deuxieme.version = "t2-04-b";
      deuxieme.id = "ca7a0002-0000-4000-8000-000000000000";

      // Deux imports de la même version ⇒ une seule ligne (clé primaire).
      expect((await importateur.importer(cloner(premier))).importe).toBe(true);
      expect((await importateur.importer(cloner(premier))).importe).toBe(true);
      const versionsApresDoublon = (await depot.listerVersions()).filter((version) =>
        version.startsWith("t2-04-"),
      );
      expect(versionsApresDoublon).toEqual(["t2-04-a"]);

      // Une nouvelle version est ajoutée ; l'ancienne reste lisible via C1.
      expect((await importateur.importer(deuxieme)).importe).toBe(true);
      const ancienne = await depot.lire("t2-04-a");
      expect(schemaReferentielCatalogue.safeParse(ancienne).success).toBe(true);
      expect(ancienne?.version).toBe("t2-04-a");
      expect(ancienne?.composants.length).toBe(1);
      expect(await depot.lire("t2-04-inconnue")).toBeUndefined();

      // Les identifiants de documents alimentent le contrôle A11 côté SCE.
      expect(await depot.listerIdentifiants()).toContain("ca7a0001-0000-4000-8000-000000000000");
    } finally {
      await nettoyerLignesTest("t2-04-");
    }
  });
});
