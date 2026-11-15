// Double format ESM + CJS (PT5) : marque le dossier CJS comme CommonJS.
// Usage (depuis la racine du paquet) : node ../../scripts/finaliser-cjs.mjs dist/cjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dossierCible = resolve(process.argv[2] ?? "dist/cjs");
mkdirSync(dossierCible, { recursive: true });
writeFileSync(
  resolve(dossierCible, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  "utf8",
);
