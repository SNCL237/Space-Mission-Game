import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Parité ESM/CJS des artefacts `dist/` (revue P1) : ce test ne s'exécute que si
// `pnpm build` a tourné — c'est le cas en CI (build avant test). Il détecte une
// rupture de la carte `exports`, du `tsconfig.cjs.json` ou du finaliseur CJS.

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paquets = [
  { nom: "@smdg/kernel", dossier: "kernel" },
  { nom: "@smdg/contracts", dossier: "contracts" },
  { nom: "@smdg/physics", dossier: "physics" },
] as const;

const distExiste = paquets.every((p) =>
  existsSync(path.join(racine, "packages", p.dossier, "dist", "cjs", "index.js")),
);

const require = createRequire(import.meta.url);

describe.skipIf(!distExiste)("parité ESM/CJS des paquets construits (T1-19)", () => {
  for (const paquet of paquets) {
    it(
      `${paquet.nom} : exports CJS et ESM strictement identiques`,
      { timeout: 30_000 },
      async () => {
        const cjs = require(paquet.nom) as Record<string, unknown>;
        const esm = (await import(paquet.nom)) as Record<string, unknown>;
        expect(Object.keys(cjs).sort(), `${paquet.nom} : clés`).toEqual(Object.keys(esm).sort());
        expect(Object.keys(cjs).length, `${paquet.nom} : surface non vide`).toBeGreaterThan(0);
      },
    );

    it(`${paquet.nom} : dist/cjs est bien en module commun`, () => {
      const fichier = path.join(racine, "packages", paquet.dossier, "dist", "cjs", "package.json");
      const paqueteJson = JSON.parse(readFileSync(fichier, "utf8")) as { type?: string };
      expect(paqueteJson.type).toBe("commonjs");
    });
  }
});
