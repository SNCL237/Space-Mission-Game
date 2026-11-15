import {
  CODES_CONCEPTION,
  CODES_CONCEPTION_TOUTES,
  schemaConfigurationFigee,
} from "@smdg/contracts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { catalogueTest, creerConfiguration, IDS, uuid } from "./aide-conception.js";

describe("conception — bilans et seuils A1/A3", () => {
  it("T3-01 : seuil de puissance orange à 90 % et rouge bloquant à 100 %", () => {
    const nominale = creerConfiguration();
    expect(nominale.calculerBilans().puissanceConsommeeW).toBe(96);
    expect(nominale.verifier().avertissements.map((erreur) => erreur.code)).not.toContain(
      CODES_CONCEPTION.PUISSANCE_ALERTE,
    );

    nominale.ajouterInstrument(IDS.cameraBassePuissance);
    const orange = nominale.verifier();
    expect(orange.avertissements.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.PUISSANCE_ALERTE,
    );
    expect(orange.erreurs.map((erreur) => erreur.code)).not.toContain(
      CODES_CONCEPTION.PUISSANCE_DEPASSEE,
    );

    const rouge = creerConfiguration();
    rouge.ajouterInstrument(IDS.radar);
    expect(rouge.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.PUISSANCE_DEPASSEE,
    );
  });

  it("T3-10 : une batterie sous la capacité minimale d'éclipse bloque", () => {
    const configuration = creerConfiguration({ capaciteBatterieWh: 1 });
    const rapport = configuration.verifier();
    expect(rapport.erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.BATTERIE_INSUFFISANTE,
    );
    expect(configuration.calculerBilans().capaciteBatterieMinWh).toBeCloseTo(146.5, 0);
  });

  it("T3-11 : le budget alerte à 90 % et bloque au-delà de 100 %", () => {
    const exemple = creerConfiguration();
    const depense = exemple.calculerBilans().coutMUSD;
    const alerte = creerConfiguration({ budgetMaxMUSD: depense / 0.9 });
    expect(alerte.verifier().avertissements.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.BUDGET_ALERTE,
    );

    const depasse = creerConfiguration({ budgetMaxMUSD: depense / 1.01 });
    expect(depasse.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.BUDGET_DEPASSE,
    );
  });
});

describe("conception — compatibilité A2 et RG1", () => {
  it("T3-02/T3-03 : sous le seuil et exactement à 90 % restent compatibles", () => {
    expect(creerConfiguration({ masseStructureKg: 300 }).verifier().erreurs).toEqual([]);
    expect(
      creerConfiguration({ masseStructureKg: 327 }).verifier().avertissements,
    ).not.toContainEqual(expect.objectContaining({ code: CODES_CONCEPTION.MARGE_FAIBLE }));
  });

  it("T3-04/T3-05 : marge faible avertie ; dépassement chiffré et trois pistes", () => {
    const proche = creerConfiguration({ masseStructureKg: 349 }).verifier();
    expect(proche.avertissements).toContainEqual(
      expect.objectContaining({ code: CODES_CONCEPTION.MARGE_FAIBLE }),
    );
    const depassee = creerConfiguration({ masseStructureKg: 379 }).verifier();
    expect(depassee.erreurs).toContainEqual(
      expect.objectContaining({
        code: CODES_CONCEPTION.MASSE_DEPASSE,
        params: expect.objectContaining({ ecartKg: 10 }),
      }),
    );
    expect(depassee.suggestions).toHaveLength(3);
    const codesInscrits = new Set<string>(CODES_CONCEPTION_TOUTES);
    expect(depassee.suggestions.every((suggestion) => codesInscrits.has(suggestion.code))).toBe(
      true,
    );
  });

  it("T3-06 : une orbite absente du lanceur rend le lancement impossible", () => {
    const configuration = creerConfiguration();
    configuration.choisirLancement(IDS.lanceurIncompatible, IDS.orbiteElliptique);
    expect(configuration.verifier().erreurs).toContainEqual(
      expect.objectContaining({ code: CODES_CONCEPTION.ORBITE_INACCESSIBLE }),
    );
  });

  it("T3-07 : sur 1000 configurations, aucune erreur dure ne passe valider()", () => {
    for (let i = 0; i < 1000; i += 1) {
      const masse = 100 + ((i * 7919) % 500);
      const configuration = creerConfiguration({ masseStructureKg: masse });
      const rapport = configuration.valider();
      const masseDepassee = masse + 51 > 420;
      if (masseDepassee) {
        expect(rapport.erreurs.map((erreur) => erreur.code)).toContain(
          CODES_CONCEPTION.MASSE_DEPASSE,
        );
        expect(rapport.valide).toBe(false);
      }
    }
  });
});

describe("conception — objectifs et options", () => {
  it("exige une association explicite instrument–objectif avant de figer C3", () => {
    const configuration = creerConfiguration({ inclureInstrument: false });
    configuration.ajouterInstrument(IDS.camera);

    expect(configuration.verifier().erreurs).toContainEqual(
      expect.objectContaining({ code: CODES_CONCEPTION.OBJECTIFS_INSTRUMENT_REQUIS }),
    );
    expect(() =>
      configuration.associerObjectifsInstrument(IDS.camera, [IDS.objectifIncompatible]),
    ).toThrow();

    configuration.associerObjectifsInstrument(IDS.camera, [IDS.objectif]);
    expect(configuration.figer().orbiteur.instruments[0]?.objectifs).toEqual([IDS.objectif]);
  });

  it("T3-08 : valide un principal avec 0 à 2 secondaires, avertit à 0, refuse 3", () => {
    const sansObjectif = creerConfiguration({ objectifPrincipal: undefined });
    expect(sansObjectif.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.OBJECTIF_PRINCIPAL_REQUIS,
    );
    const aucunSecondaire = creerConfiguration({ objectifsSecondaires: [] }).verifier();
    expect(aucunSecondaire.erreurs).toEqual([]);
    expect(aucunSecondaire.avertissements.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.OBJECTIFS_SECONDAIRES_ABSENTS,
    );
    expect(
      creerConfiguration({ objectifsSecondaires: [uuid(502), uuid(504)] }).verifier().erreurs,
    ).toEqual([]);
    const trop = creerConfiguration({
      objectifsSecondaires: [uuid(502), uuid(504), uuid(505)],
    }).verifier();
    expect(trop.erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.OBJECTIFS_TROP_NOMBREUX,
    );
  });

  it("T3-10 : la difficulté borne les objectifs et les composants sélectionnables", () => {
    const decouverte = creerConfiguration({
      difficulte: "decouverte",
      objectifsSecondaires: [IDS.objectifSecondaire],
      inclureElements: false,
      inclureInstrument: false,
    });
    expect(decouverte.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.NIVEAU_OBJECTIFS_INVALIDE,
    );
    expect(() => decouverte.ajouterElement(IDS.extra)).toThrow(
      expect.objectContaining({ code: CODES_CONCEPTION.OPTION_INDISPONIBLE }),
    );
    expect(
      creerConfiguration({
        difficulte: "ingenieur",
        objectifsSecondaires: [IDS.objectifSecondaire],
      })
        .verifier()
        .erreurs.map((erreur) => erreur.code),
    ).not.toContain(CODES_CONCEPTION.NIVEAU_OBJECTIFS_INVALIDE);
  });

  it("T3-09 : option incompatible est indisponible et sa sélection échoue", () => {
    const catalogue = catalogueTest({ incompatiblesAvec: [IDS.objectif] });
    const configuration = creerConfiguration({ catalogue, inclureInstrument: false });
    const option = configuration
      .optionsDisponibles()
      .find((candidate) => candidate.id === IDS.camera);
    expect(option).toEqual(
      expect.objectContaining({
        disponible: false,
        raison: CODES_CONCEPTION.OPTION_INDISPONIBLE,
      }),
    );
    expect(() => configuration.ajouterInstrument(IDS.camera)).toThrow(
      expect.objectContaining({ code: CODES_CONCEPTION.OPTION_INDISPONIBLE }),
    );
  });
});

describe("conception — recalcul et C3", () => {
  it("T3-12 : l'ordre d'ajout des mêmes éléments ne change pas les bilans", () => {
    const premier = creerConfiguration();
    const second = creerConfiguration({ inclureElements: false, inclureInstrument: false });
    for (const id of [IDS.propulsion, IDS.panneau, IDS.structure, IDS.batterie]) {
      second.ajouterElement(id);
    }
    second.ajouterInstrument(IDS.camera);
    expect(second.calculerBilans()).toEqual(premier.calculerBilans());
  });

  it("T3-13 : accroître la marge DV augmente le carburant et recalcule la masse", () => {
    const configuration = creerConfiguration({ deltaVms: 1000, capacitePolaireKg: 196.4 });
    const initial = configuration.calculerBilans();
    expect(configuration.verifier().erreurs.map((erreur) => erreur.code)).not.toContain(
      CODES_CONCEPTION.MASSE_DEPASSE,
    );
    configuration.definirMargeDv(0.2);
    const suivant = configuration.calculerBilans();
    expect(suivant.carburantKg).toBeGreaterThan(initial.carburantKg);
    expect(suivant.masseTotaleKg).toBeGreaterThan(initial.masseTotaleKg);
    expect(configuration.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.MASSE_DEPASSE,
    );
  });

  it("T3-10 : une mission avec delta-v refuse une propulsion ou un Isp manquant", () => {
    const sansMoteur = creerConfiguration({ deltaVms: 1000, inclureElements: false });
    expect(sansMoteur.verifier().erreurs.map((erreur) => erreur.code)).toContain(
      CODES_CONCEPTION.PROPULSION_CONFIGURATION_INVALIDE,
    );

    const catalogue = catalogueTest();
    const moteur = catalogue.composants.find((item) => item.id === IDS.propulsion);
    if (moteur === undefined) throw new Error("fixture propulsion absente");
    delete moteur.ispS;
    const sansIsp = creerConfiguration({ catalogue, deltaVms: 1000 });
    expect(sansIsp.verifier().erreurs).toContainEqual(
      expect.objectContaining({
        code: CODES_CONCEPTION.PARAMETRE_CATALOGUE_MANQUANT,
        params: expect.objectContaining({ champ: "ispS" }),
      }),
    );
  });

  it("T3-14 : figer produit un C3 immuable et conserve les versions précédentes", () => {
    const configuration = creerConfiguration();
    const premier = configuration.figer();
    expect(schemaConfigurationFigee.safeParse(premier).success).toBe(true);
    expect(Object.isFrozen(premier.orbiteur.elements[0])).toBe(true);
    configuration.definirMargeDv(0.2);
    expect(premier.margeDv).toBe(0.1);
    const second = configuration.figer();
    expect(second.version).toBe(premier.version + 1);
    expect(configuration.lireVersionFigee(premier.version)).toBe(premier);
    expect(configuration.valider().valide).toBe(true);
    expect(configuration.niveauMaturite()).toBe(4);
  });

  it("T3-17 : maturité calculée progresse sans persister de nouveaux statuts", () => {
    const configuration = creerConfiguration();
    expect(configuration.niveauMaturite()).toBe(1);
    configuration.valider();
    expect(configuration.niveauMaturite()).toBe(2);
    const variante = creerConfiguration({ configurationId: uuid(603) });
    configuration.comparerAvec(variante);
    configuration.comparerAvec(
      creerConfiguration({ configurationId: uuid(604), masseStructureKg: 90 }),
    );
    expect(configuration.niveauMaturite()).toBe(3);
    configuration.figer();
    expect(configuration.niveauMaturite()).toBe(4);
  });

  it("T3-18 : estimerImpact égale l'application sur une copie sans muter l'original", () => {
    const configuration = creerConfiguration({ deltaVms: 1000 });
    const avant = configuration.calculerBilans();
    const estime = configuration.estimerImpact({ margeDv: 0.2 });
    const copie = creerConfiguration({ deltaVms: 1000 });
    copie.definirMargeDv(0.2);
    expect(estime).toEqual(copie.calculerBilans());
    expect(configuration.calculerBilans()).toEqual(avant);
  });

  it("T3-19 : le gabarit LRO de 1916 kg est calculé sans limite codée à 310 kg", async () => {
    const lro = JSON.parse(
      readFileSync(new URL("./fixtures/lro-like.json", import.meta.url), "utf8"),
    ) as { masseSecheKg: number; source: string };
    const configuration = creerConfiguration({
      catalogue: catalogueTest({ masseStructureKg: lro.masseSecheKg }),
      deltaVms: 0,
    });
    expect(configuration.calculerBilans().masseSecheKg).toBe(1916 + 12 + 9 + 12 + 18);
  });

  it("T3-20 : recalculer les bilans de 30 éléments prend moins de 5 ms en moyenne", () => {
    const configuration = creerConfiguration();
    for (let i = 0; i < 30; i += 1) configuration.ajouterElement(IDS.structure);
    for (let i = 0; i < 20; i += 1) configuration.calculerBilans();
    const debut = performance.now();
    for (let i = 0; i < 100; i += 1) configuration.calculerBilans();
    expect((performance.now() - debut) / 100).toBeLessThan(5);
  });
});

describe("conception — registre de codes", () => {
  it("T3-16 : tous les codes émis et suggérés appartiennent au registre C7/PED", () => {
    const rapport = creerConfiguration({ masseStructureKg: 430 }).verifier();
    const inscrits = new Set<string>(CODES_CONCEPTION_TOUTES);
    for (const code of [...rapport.erreurs, ...rapport.avertissements, ...rapport.suggestions]) {
      expect(inscrits.has(code.code)).toBe(true);
    }
  });
});
