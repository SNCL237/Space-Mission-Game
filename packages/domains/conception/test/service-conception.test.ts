import type { PortCatalogue } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ServiceConception } from "../src/application/service-conception.js";
import { ErreurConception } from "../src/domain/erreur-conception.js";
import { catalogueTest, IDS, uuid } from "./aide-conception.js";

describe("conception — lecture C1 par port (T3-15)", () => {
  it("crée une configuration à partir d'un C1 simulé sans importer CAT", async () => {
    const catalogue = catalogueTest();
    const port: PortCatalogue = {
      async listerVersions() {
        return [catalogue.version];
      },
      async lire(version) {
        return version === catalogue.version ? catalogue : undefined;
      },
      async listerIdentifiants() {
        return [];
      },
    };
    const service = new ServiceConception(port);
    const configuration = await service.creer({
      configurationId: uuid(701),
      scenarioId: uuid(702),
      versionScenario: "1.0.0",
      versionCatalogue: catalogue.version,
      budgetMaxMUSD: 100,
      deltaVms: 0,
      margeDv: 0,
      dureeMissionAns: 1,
      coutOperationsAnnuelMUSD: 0,
      profondeurDecharge: 0.5,
      rendement: 0.9,
      tempsObservationSParJour: 3600,
      difficulte: "expert",
    });
    configuration.choisirObjectifs(IDS.objectif, []);
    configuration.choisirLancement(IDS.lanceur, IDS.orbite);
    expect(configuration.optionsDisponibles()).toContainEqual(
      expect.objectContaining({ id: IDS.camera, disponible: true }),
    );
  });

  it("refuse explicitement une version de catalogue inconnue", async () => {
    const service = new ServiceConception({
      async listerVersions() {
        return [];
      },
      async lire() {
        return undefined;
      },
      async listerIdentifiants() {
        return [];
      },
    });
    await expect(
      service.creer({
        configurationId: uuid(703),
        scenarioId: uuid(704),
        versionScenario: "1.0.0",
        versionCatalogue: "absente",
        budgetMaxMUSD: 1,
        deltaVms: 0,
        margeDv: 0,
        dureeMissionAns: 1,
        coutOperationsAnnuelMUSD: 0,
        profondeurDecharge: 0.5,
        rendement: 0.9,
        tempsObservationSParJour: 3600,
        difficulte: "expert",
      }),
    ).rejects.toBeInstanceOf(ErreurConception);
  });

  it("refuse un référentiel C1 mal formé avec un code explicite", async () => {
    const catalogueInvalide = structuredClone(catalogueTest());
    catalogueInvalide.composants[0]!.dutyCycle = 2;
    const service = new ServiceConception({
      async listerVersions() {
        return ["invalide"];
      },
      async lire() {
        return catalogueInvalide;
      },
      async listerIdentifiants() {
        return [];
      },
    });
    await expect(
      service.creer({
        configurationId: uuid(705),
        scenarioId: uuid(706),
        versionScenario: "1.0.0",
        versionCatalogue: "invalide",
        budgetMaxMUSD: 1,
        deltaVms: 0,
        margeDv: 0,
        dureeMissionAns: 1,
        coutOperationsAnnuelMUSD: 0,
        profondeurDecharge: 0.5,
        rendement: 0.9,
        tempsObservationSParJour: 3600,
        difficulte: "expert",
      }),
    ).rejects.toMatchObject({ code: "CATALOGUE_C1_INVALIDE" });
  });
});
