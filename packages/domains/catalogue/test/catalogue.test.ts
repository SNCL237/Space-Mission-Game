import "reflect-metadata";

import { fractionEclipseMax, periode } from "@smdg/physics";
import { schemaLanceurCatalogue, schemaReferentielCatalogue } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ImporterCatalogue } from "../src/application/importer-catalogue.js";
import { projeterVersC1 } from "../src/domain/projection.js";
import { schemaCatalogue, type DocumentCatalogue } from "../src/domain/schema-catalogue.js";
import { chargerCatalogueDepuisDisque } from "../src/infrastructure/source-donnees.js";
import { DepotMemoire, cloner, documentMinimal } from "./aide-catalogue.js";

// T2-01 → T2-08 : validation du catalogue JSON (F2.1), règles de source
// RG12 (T2-02), écarts gameplay/reference (T2-05), cohérence physique
// (T2-06/T2-07) et capacités de lanceur partielles (T2-08, A2/Q-17).

function importeur(): ImporterCatalogue {
  return new ImporterCatalogue(new DepotMemoire());
}

/** Document catalogue livré sur disque (fragments `data/` fusionnés). */
function catalogueDisque(): DocumentCatalogue {
  const parse = schemaCatalogue.safeParse(chargerCatalogueDepuisDisque());
  if (!parse.success) {
    throw new Error(`catalogue/data invalide : ${parse.error.issues[0]?.message ?? ""}`);
  }
  return parse.data;
}

describe("catalogue — JSON du domaine (T2-01, T2-02)", () => {
  it("T2-01 : 100 % des JSON du catalogue sont valides ; l'import refuse un élément sans source", async () => {
    const brut = chargerCatalogueDepuisDisque();
    // 1. Le document livré passe intégralement le schéma domaine :
    expect(schemaCatalogue.safeParse(brut).success).toBe(true);

    // 2. Et l'import complet aboutit (usage réel, dépôt mémoire).
    const depot = new DepotMemoire();
    const rapport = await new ImporterCatalogue(depot).importer(brut);
    expect(rapport.importe).toBe(true);
    expect(rapport.version).toBe("1.2.0");
    expect(await depot.listerVersions()).toEqual(["1.2.0"]);

    // 3. Un composant sans `source` fait échouer l'import (rien n'est stocké).
    const sansSource = cloner(brut) as Record<string, unknown>;
    const composants = sansSource["composants"] as Record<string, unknown>[];
    delete composants[0]?.["source"];
    const refus = await importeur().importer(sansSource);
    expect(refus.importe).toBe(false);
    expect(refus.erreurs.length).toBeGreaterThan(0);
    expect(refus.erreurs.some((erreur) => erreur.code.startsWith("CATALOGUE_"))).toBe(true);

    // 4. Une source réelle sans `urlSource` échoue aussi (RG12).
    const sansUrl = cloner(brut) as DocumentCatalogue;
    sansUrl.instruments[0]!.source = "NASA LRO";
    delete (sansUrl.instruments[0] as Record<string, unknown>)["urlSource"];
    const refusUrl = await importeur().importer(sansUrl);
    expect(refusUrl.importe).toBe(false);
    expect(refusUrl.erreurs.some((erreur) => erreur.code === "CATALOGUE_SOURCE_INVALIDE")).toBe(
      true,
    );
  });

  it("T2-02 : source réelle ⇒ urlSource https ; domaines acceptés configurables", async () => {
    const base = documentMinimal();

    // a) source réelle sans URL → refus.
    const sansUrl = cloner(base);
    sansUrl.instruments[0]!.source = "NASA LRO";
    const refusSansUrl = await importeur().importer(sansUrl);
    expect(refusSansUrl.importe).toBe(false);
    expect(refusSansUrl.erreurs[0]?.code).toBe("CATALOGUE_SOURCE_INVALIDE");

    // b) URL non-https → refus.
    const http = cloner(base);
    http.instruments[0]!.source = "NASA LRO";
    http.instruments[0]!.urlSource = "http://science.nasa.gov/mission/lro/";
    const refusHttp = await importeur().importer(http);
    expect(refusHttp.importe).toBe(false);
    expect(refusHttp.erreurs[0]?.code).toBe("CATALOGUE_SOURCE_INVALIDE");

    // c) URL https sur un domaine accepté (défaut nasa.gov) → accepté.
    const https = cloner(base);
    https.instruments[0]!.source = "NASA LRO";
    https.instruments[0]!.urlSource = "https://science.nasa.gov/mission/lro/";
    expect((await importeur().importer(https)).importe).toBe(true);

    // d) domaine hors liste par défaut → refus.
    const horsListe = cloner(base);
    horsListe.instruments[0]!.source = "Observatoire Example";
    horsListe.instruments[0]!.urlSource = "https://exemple.org/instruments";
    const refusHorsListe = await importeur().importer(horsListe);
    expect(refusHorsListe.importe).toBe(false);

    // e) liste **configurable** (T2-02) : exemple.org accepté, nasa.gov rejeté.
    const options = { domainesAcceptes: ["exemple.org"] };
    expect((await importeur().importer(cloner(horsListe), options)).importe).toBe(true);
    const refusNasa = await importeur().importer(cloner(https), options);
    expect(refusNasa.importe).toBe(false);
    expect(refusNasa.erreurs[0]?.code).toBe("CATALOGUE_SOURCE_INVALIDE");
  });
});

describe("catalogue — instruments et orbites du référentiel livré", () => {
  it("T3 : projette les paramètres techniques C1 nécessaires à la conception", () => {
    const projection = projeterVersC1(catalogueDisque());
    expect(projection.instruments.some((instrument) => instrument.missionsReelles?.length)).toBe(
      true,
    );
    const batterie = projection.composants.find((composant) =>
      composant.categorie.startsWith("energie-batterie"),
    );
    const moteur = projection.composants.find((composant) => composant.categorie === "propulsion");
    const panneau = projection.composants.find(
      (composant) => composant.categorie === "energie-panneau",
    );

    expect(batterie?.capaciteBatterieWh).toBeGreaterThan(0);
    expect(moteur?.ispS).toBeGreaterThan(0);
    expect(panneau?.degradationAn).toBeGreaterThanOrEqual(0);
    expect(projection.instruments.every((instrument) => instrument.dutyCycle !== undefined)).toBe(
      true,
    );
  });

  it("T2-05 : rapport masse et puissance gameplay/réelle des instruments ∈ [0,3 ; 3]", () => {
    const document = catalogueDisque();
    expect(document.instruments.length).toBeGreaterThanOrEqual(4);
    for (const instrument of document.instruments) {
      const reference = instrument.reference;
      expect(reference, `${instrument.nom} : bloc reference attendu`).toBeDefined();
      expect(reference?.masseKg, `${instrument.nom} : masse réelle`).toBeGreaterThan(0);
      expect(reference?.powerW, `${instrument.nom} : puissance réelle`).toBeGreaterThan(0);
      const masse = instrument.gameplay.masseKg / (reference?.masseKg ?? NaN);
      const puissance = instrument.gameplay.powerW / (reference?.powerW ?? NaN);
      expect(masse, `${instrument.nom} : rapport masse`).toBeGreaterThanOrEqual(0.3);
      expect(masse, `${instrument.nom} : rapport masse`).toBeLessThanOrEqual(3);
      expect(puissance, `${instrument.nom} : rapport puissance`).toBeGreaterThanOrEqual(0.3);
      expect(puissance, `${instrument.nom} : rapport puissance`).toBeLessThanOrEqual(3);
    }
  });

  it("T2-06 : période de chaque orbite = physics.periode à 0,1 % près", () => {
    const document = catalogueDisque();
    expect(document.orbites.length).toBe(3);
    for (const orbite of document.orbites) {
      const attendu = periode(orbite.gameplay.altitudeKm);
      const ecartRelatif = Math.abs(orbite.gameplay.periodeS - attendu) / attendu;
      expect(ecartRelatif, `${orbite.type} : écart ${ecartRelatif}`).toBeLessThanOrEqual(0.001);
    }
  });

  it("T2-07 : fractionOmbre ≤ fraction géométrique maximale de l'altitude", () => {
    const document = catalogueDisque();
    for (const orbite of document.orbites) {
      const maximum = fractionEclipseMax(orbite.gameplay.altitudeKm);
      expect(
        orbite.gameplay.fractionOmbre,
        `${orbite.type} : ${orbite.gameplay.fractionOmbre} ≤ ${maximum}`,
      ).toBeLessThanOrEqual(maximum);
    }
    // L'exemple d'analyse (0,35 à 100 km) passe, cité dans le PLAN (T2-07).
    const polaire = document.orbites.find((orbite) => orbite.type === "polaire");
    // Valeur géométrique exacte (asin(R/a)/π, 100 km), arrondie par défaut — audit front↔back.
    expect(polaire?.gameplay.fractionOmbre).toBe(0.3944);
  });

  it("T2-08 : chaque lanceur ne déclare que ses orbites accessibles (A2, Q-17)", () => {
    const document = catalogueDisque();
    const typesOrbites = new Set(document.orbites.map((orbite) => orbite.type));

    // 1. Le schéma C1 (record partiel) accepte les tables livrées :
    const projection = projeterVersC1(document);
    expect(schemaReferentielCatalogue.safeParse(projection).success).toBe(true);
    for (const lanceur of projection.lanceurs) {
      expect(schemaLanceurCatalogue.safeParse(lanceur).success).toBe(true);
      expect(Object.keys(lanceur.capaciteKg).length).toBeGreaterThan(0);
    }

    // 2. Le lanceur léger n'a PAS de clé `elliptique` : une orbite elliptique
    //    sur ce lanceur rend donc possible le code `ORBITE_INACCESSIBLE` (A2).
    const leger = projection.lanceurs.find((lanceur) => lanceur.classe === "leger");
    expect(leger).toBeDefined();
    expect(leger?.capaciteKg).not.toHaveProperty("elliptique");

    // 3. Au moins un couple (lanceur, orbite) du catalogue est inaccessible.
    const inaccessible = projection.lanceurs.some((lanceur) =>
      [...typesOrbites].some((type) => !(type in lanceur.capaciteKg)),
    );
    expect(inaccessible).toBe(true);
  });
});
