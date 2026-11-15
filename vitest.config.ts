import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Un « projet » par paquet ; le projet racine couvre les tests de base (P0).
    projects: [
      { test: { name: "root", include: ["test/**/*.test.ts"], environment: "node" } },
      // `packages/*` sans `domains` : sinon le dossier `packages/domains`
      // deviendrait un projet parapluie qui rejouerait chaque test de domaine.
      "packages/!(domains)",
      "packages/domains/*",
      "apps/*",
    ],
  },
});
