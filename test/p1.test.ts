import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// P1 : contrôles transverses — pureté des paquets (T1-13) et traçabilité des
// hypothèses dans docs/QUESTIONS.md (T1-10).

/** Paquets qui doivent rester purs (RI3 : ni NestJS ni horloge/aléatoire globaux). */
const PAQUETS_PURS = ["kernel", "contracts", "physics"] as const;

const INTERDITS: ReadonlyArray<{ readonly motif: RegExp; readonly libelle: string }> = [
  { motif: /Math\s*\.\s*random/, libelle: "Math.random" },
  { motif: /Date\s*\.\s*now/, libelle: "Date.now" },
  { motif: /\bfetch\s*\(/, libelle: "fetch" },
  { motif: /@nestjs\//, libelle: "@nestjs/*" },
];

function sourcesDuPaquet(nomPaquet: string): string[] {
  const racine = join(process.cwd(), "packages", nomPaquet, "src");
  return readdirSync(racine, { recursive: true, encoding: "utf8" })
    .filter((chemin) => chemin.endsWith(".ts") && !chemin.endsWith(".d.ts"))
    .map((chemin) => join(racine, chemin));
}

describe("P1 — contrôles transverses", () => {
  it("T1-13 : aucune occurrence de Math.random, Date.now, fetch ou @nestjs/* dans kernel, contracts, physics", () => {
    let controles = 0;
    for (const nomPaquet of PAQUETS_PURS) {
      for (const fichier of sourcesDuPaquet(nomPaquet)) {
        const contenu = readFileSync(fichier, "utf8");
        for (const { motif, libelle } of INTERDITS) {
          controles += 1;
          expect(
            motif.test(contenu),
            `${nomPaquet} : ${fichier.replace(process.cwd(), ".")} ne doit pas contenir ${libelle}`,
          ).toBe(false);
        }
      }
    }
    // Au moins un fichier par paquet et quatre motifs vérifiés.
    expect(controles).toBeGreaterThanOrEqual(PAQUETS_PURS.length * INTERDITS.length);
  });

  it("T1-10 : QUESTIONS.md consigne l'écart A4 vs LRO dans la ligne Q-01", () => {
    const contenu = readFileSync(join(process.cwd(), "docs", "QUESTIONS.md"), "utf8");
    const ligneQ01 = contenu.split("\n").find((ligne) => ligne.startsWith("| Q-01"));
    expect(ligneQ01, "la ligne Q-01 doit exister").toBeDefined();
    // Contact calculé par A4 tel qu'écrit (4,3 min ≈ 4,28 min à 50 km) vs réalité LRO.
    expect(ligneQ01).toMatch(/4,3 min/);
    expect(ligneQ01).toMatch(/6 passes/);
    expect(ligneQ01).toMatch(/1 h/);
  });
});
