import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { schemaPaquetScenario } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ImporterPaquets } from "../src/application/importer-paquets.js";
import { ValiderPaquet } from "../src/application/valider-paquet.js";
import { schemaPaquetScenarioSc } from "../src/domain/schema-paquet.js";
import { CODES_A11, trouverCycle, validerPaquetA11 } from "../src/domain/validation-a11.js";
import {
  DepotMemoireScenarios,
  cloner,
  contexteValide,
  fauxPortCatalogue,
  paquetLunaire,
  paquetsDisques,
} from "./aide-scenarios.js";

// T2-09 → T2-14, T2-17 : validation A11 du paquet lunaire (F2.9), toutes les
// erreurs renvoyées en une fois, textes bilingues (T2-11), RG6 (T2-12),
// RG5 « par construction » (T2-13), faits réels sourcés (T2-14), budget
// cohérent avec LCROSS (T2-17).

function validerAvecContexte(paquet: unknown): ReturnType<typeof validerPaquetA11> {
  return validerPaquetA11(paquet, contexteValide());
}

function codes(erreurs: { code: string }[]): Set<string> {
  return new Set(erreurs.map((erreur) => erreur.code));
}

describe("scénarios — A11 sur le paquet livré (T2-09)", () => {
  it("T2-09 : le paquet lunaire passe A11 sans erreur", async () => {
    const depot = new DepotMemoireScenarios();
    const valider = new ValiderPaquet(
      fauxPortCatalogue([contexteValide().identifiantsCatalogue[0]!]),
      depot,
    );
    const rapport = await valider.valider(paquetLunaire());
    expect(rapport.erreurs).toEqual([]);
    expect(rapport.valide).toBe(true);

    // Et il est bien un C2 (contrat gelé) : importable en base tel quel.
    expect(schemaPaquetScenario.safeParse(paquetLunaire()).success).toBe(true);
  });
});

describe("scénarios — A11 : toutes les erreurs en une fois (T2-10)", () => {
  /** Cinq défauts dans un SEUL paquet : 6 actes, 3 fins, fin sans règle,
   *  identifiant catalogue inconnu, condition de déblocage cyclique. */
  function paquetAuxCinqDefauts(): unknown {
    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    const actes = paquet["actes"] as unknown[];
    actes.splice(6); // 6 actes au lieu de 7
    const fins = paquet["fins"] as Record<string, unknown>[];
    fins.splice(3); // 3 fins au lieu de 4
    fins[0]!["regles"] = []; // première fin inatteignable (HYPOTHESE Q-13)
    paquet["catalogueAutorise"] = ["00000000-0000-4000-8000-000000000000"]; // inconnu de CAT
    paquet["conditionsDeblocage"] = [
      {
        id: "c04d0001-0000-4000-8000-000000000000",
        type: "prerequis",
        scenarioPrerequis: paquet["id"], // auto-référence = cycle
      },
    ];
    return paquet;
  }

  it("T2-10 : les 5 défauts sont tous identifiés dans une seule réponse", () => {
    const erreurs = validerAvecContexte(paquetAuxCinqDefauts());
    const trouves = codes(erreurs);
    expect(trouves).toContain(CODES_A11.ACTES_INVALIDE);
    expect(trouves).toContain(CODES_A11.FINS_INVALIDE);
    expect(trouves).toContain(CODES_A11.FIN_INATTEIGNABLE);
    expect(trouves).toContain(CODES_A11.CATALOGUE_INCONNU);
    expect(trouves).toContain(CODES_A11.CYCLE_DEBLOCAGE);
    expect(trouves.size).toBeGreaterThanOrEqual(5);
    // Chaque erreur porte ses paramètres de diagnostic (jamais de texte joueur).
    for (const erreur of erreurs) {
      expect(typeof erreur.params["champs"]).toBe("string");
      expect(erreur.version).toBe(1);
    }
  });

  it("T2-10 : publication refusée — un paquet défaillant n'est jamais stocké", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "smdg-paquets-"));
    const sauvegarde = process.env["SMDG_SCENARIOS_DATA_DIR"];
    try {
      mkdirSync(join(dossier, "paquet-malade"), { recursive: true });
      writeFileSync(
        join(dossier, "paquet-malade", "paquet.json"),
        JSON.stringify(paquetAuxCinqDefauts()),
      );
      process.env["SMDG_SCENARIOS_DATA_DIR"] = dossier;

      const depot = new DepotMemoireScenarios();
      const valider = new ValiderPaquet(
        fauxPortCatalogue(contexteValide().identifiantsCatalogue),
        depot,
      );
      const importateur = new ImporterPaquets(valider, depot);
      const rapport = await importateur.importerTout();

      expect(rapport.publie).toBe(0);
      expect(rapport.erreurs.length).toBeGreaterThan(0);
      expect(codes(rapport.erreurs)).toContain(CODES_A11.ACTES_INVALIDE);
      expect(depot.paquets.size).toBe(0);
      expect(rapport.erreurs[0]?.params["fichier"]).toBe("paquet-malade/paquet.json");
    } finally {
      if (sauvegarde === undefined) delete process.env["SMDG_SCENARIOS_DATA_DIR"];
      else process.env["SMDG_SCENARIOS_DATA_DIR"] = sauvegarde;
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("T2-10 : cycle à deux scénarios (A ⇄ B) détecté via le contexte", () => {
    const idA = "5ce40009-0000-4000-8000-000000000000";
    const idB = "5ce4000a-0000-4000-8000-000000000000";
    expect(
      trouverCycle([
        { id: idA, prerequis: [idB] },
        { id: idB, prerequis: [idA] },
      ]),
    ).toBeDefined();
    expect(trouverCycle([{ id: idA, prerequis: [] }])).toBeUndefined();

    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    paquet["id"] = idA; // le paquet validé EST le nœud A du cycle A ⇄ B
    paquet["conditionsDeblocage"] = [
      { id: "c04d0002-0000-4000-8000-000000000000", type: "prerequis", scenarioPrerequis: idB },
    ];
    const erreurs = validerPaquetA11(paquet, {
      identifiantsCatalogue: contexteValide().identifiantsCatalogue,
      scenariosConnus: [{ id: idB, prerequis: [idA] }],
    });
    const trouves = codes(erreurs);
    expect(trouves).toContain(CODES_A11.CYCLE_DEBLOCAGE);
    expect(trouves).not.toContain(CODES_A11.SCENARIO_INCONNU);
  });

  it("T2-10 : un prérequis vers un scénario inconnu est refusé (A11)", () => {
    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    paquet["conditionsDeblocage"] = [
      {
        id: "c04d0003-0000-4000-8000-000000000000",
        type: "prerequis",
        scenarioPrerequis: "5ce400ff-0000-4000-8000-000000000000",
      },
    ];
    const trouves = codes(validerAvecContexte(paquet));
    expect(trouves).toContain(CODES_A11.SCENARIO_INCONNU);
    expect(trouves).not.toContain(CODES_A11.CYCLE_DEBLOCAGE);
  });
});

describe("scénarios — textes bilingues (T2-11)", () => {
  it("T2-11 : 7 actes et 0 clé fr/en manquante dans tous les paquets du disque", () => {
    const paquets = paquetsDisques();
    expect(paquets.length).toBeGreaterThanOrEqual(1);
    for (const paquet of paquets) {
      expect(paquet.actes).toHaveLength(7);
      const textes = [
        ...paquet.actes.flatMap((acte) => [acte.titre, acte.description]),
        ...paquet.fins.flatMap((fin) => [fin.titre, fin.conclusion]),
        ...paquet.evenementsNarratifs.map((evenement) => evenement.texte),
        ...paquet.personnages.flatMap((personnage) => [
          personnage.nom,
          personnage.role,
          personnage.motivation,
        ]),
        ...paquet.archives.flatMap((archive) => [archive.titre, archive.contenu]),
      ];
      const manquants = textes.filter(
        (texte) => texte.fr.trim() === "" || texte.en.trim() === "" || typeof texte.fr !== "string",
      );
      expect(manquants).toEqual([]);
    }
  });

  it("T2-11 : une clé `en` supprimée produit PAQUET_TEXTE_MANQUANT", () => {
    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    const actes = paquet["actes"] as { titre: Record<string, unknown> }[];
    delete actes[0]!.titre["en"];
    const trouves = codes(validerAvecContexte(paquet));
    expect(trouves).toContain(CODES_A11.TEXTE_MANQUANT);
    expect(trouves).not.toContain(CODES_A11.ACTES_INVALIDE);
  });
});

describe("scénarios — RG6 et RG5 (T2-12, T2-13)", () => {
  it("T2-12 : RG6 — une définition critique sans indice est refusée", () => {
    // Le paquet livré respecte RG6 : sa définition critique porte un indice.
    expect(codes(validerAvecContexte(paquetLunaire()))).not.toContain(
      CODES_A11.EVENEMENT_SANS_INDICE,
    );

    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    const definitions = paquet["definitionsEvenements"] as Record<string, unknown>[];
    const critique = definitions.find((definition) => definition["critique"] === true);
    expect(critique).toBeDefined();
    critique!["indice"] = "";
    expect(codes(validerAvecContexte(paquet))).toContain(CODES_A11.EVENEMENT_SANS_INDICE);
  });

  it("T2-13 : RG5 par construction — conséquence hors des 4 types refusée", () => {
    const paquet = cloner(paquetLunaire()) as unknown as Record<string, unknown>;
    const evenements = paquet["evenementsNarratifs"] as Record<string, unknown>[];
    evenements[0]!["consequence"] = "mort"; // jamais un sacrifice humain (RG5)
    expect(schemaPaquetScenarioSc.safeParse(paquet).success).toBe(false);
    expect(codes(validerAvecContexte(paquet))).toContain(CODES_A11.EVENEMENT_INVALIDE);

    // Les 4 types autorisés passent (portée sur les 4 événements livrés).
    const types = paquetsDisques()[0]!.evenementsNarratifs.map(
      (evenement) => evenement.consequence,
    );
    expect(new Set(types)).toEqual(new Set(["instrument", "donnees", "objectif", "dureeVie"]));
  });
});

describe("scénarios — faits réels et fictions (T2-14)", () => {
  it("T2-14 : tout `realFact` est sourcé (https) ; LUNAR-01 et les personnages sont `fiction`", () => {
    for (const paquet of paquetsDisques()) {
      for (const archive of paquet.archives) {
        // realFact xor fiction (jamais les deux, jamais ni l'un ni l'autre).
        expect(archive.realFact !== archive.fiction).toBe(true);
        if (archive.realFact) {
          expect(archive.source, archive.titre.fr).toBeDefined();
          expect(archive.urlSource?.startsWith("https://"), archive.titre.fr).toBe(true);
        }
      }
      expect(paquet.personnages.length).toBeGreaterThan(0);
      expect(paquet.personnages.every((personnage) => personnage.fiction)).toBe(true);
    }

    // LUNAR-01 (mission fictive) apparaît marquée `fiction: true` (PLAN §1.4).
    const lunaire = paquetLunaire();
    const archiveLunar = lunaire.archives.find(
      (archive) =>
        archive.fiction &&
        (archive.titre.fr.includes("LUNAR-01") || archive.contenu.fr.includes("LUNAR-01")),
    );
    expect(archiveLunar).toBeDefined();

    // Un fait réel sans source est refusé par le schéma.
    const sansSource = cloner(lunaire) as unknown as Record<string, unknown>;
    const archives = sansSource["archives"] as Record<string, unknown>[];
    const realFact = archives.find((archive) => archive["realFact"] === true);
    expect(realFact).toBeDefined();
    delete realFact!["source"];
    expect(schemaPaquetScenarioSc.safeParse(sansSource).success).toBe(false);
  });
});

describe("scénarios — budget (T2-17)", () => {
  it("T2-17 : budgetMaxMUSD ∈ [0,5 × 79 ; 2 × 79] pour chaque paquet livré", () => {
    for (const paquet of paquetsDisques()) {
      expect(paquet.budgetMaxMUSD, paquet.id).toBeGreaterThanOrEqual(0.5 * 79);
      expect(paquet.budgetMaxMUSD, paquet.id).toBeLessThanOrEqual(2 * 79);
    }
  });
});
