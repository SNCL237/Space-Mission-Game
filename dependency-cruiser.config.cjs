// @ts-check
// RI1–RI7 : frontières d'architecture.
// SMDG_CRUISE_SCOPE permet de rejouer les mêmes règles sur des fixtures
// (tests volontairement fautifs T0-03 / T0-04).
const scope = process.env.SMDG_CRUISE_SCOPE || "packages";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // RI1 : un domaine n'importe jamais un autre domaine (liaison via contracts uniquement).
    {
      name: "domaines-isoles",
      comment:
        "Un domaine (packages/domains/<x>/src) ne peut importer qu'un autre domaine via son jeton de port dans contracts.",
      severity: "error",
      from: { path: `^${scope}/domains/([^/]+)/src` },
      to: {
        path: `^${scope}/domains/([^/]+)/src`,
        pathNot: `^${scope}/domains/$1/src`,
      },
    },
    // RI2 : kernel, contracts et physics ne dépendent d'aucun domaine.
    {
      name: "noyau-vers-domaine",
      comment: "kernel/contracts/physics ne doivent jamais importer un domaine.",
      severity: "error",
      from: { path: `^${scope}/(kernel|contracts|physics)/` },
      to: { path: `^${scope}/domains/` },
    },
    // RI3 : zéro import @nestjs/* dans les règles pures.
    {
      name: "pas-de-nestjs-dans-le-pur",
      comment: "Les paquets purs et les sous-dossiers domain/ ne référencent jamais NestJS.",
      severity: "error",
      from: { path: `^${scope}/(kernel|contracts|physics)/|domain/` },
      // Chemin résolu réel (layout pnpm) : on matche « @nestjs/ » quelle que soit la racine.
      to: { path: "(^|/)@nestjs/" },
    },
    // RI4 : simulation/evaluation ne dépendent que de kernel, contracts, physics.
    {
      name: "moteurs-vers-noyau-seulement",
      comment: "simulation et evaluation s'appuient uniquement sur kernel, contracts, physics.",
      severity: "error",
      from: { path: `^${scope}/domains/(simulation|evaluation)/` },
      to: {
        path: `^${scope}/domains/`,
        pathNot: `^${scope}/domains/(simulation|evaluation)/`,
      },
    },
    // RI6 : apps/server est la racine de composition unique — personne ne l'importe.
    {
      name: "domaines-vers-app",
      comment: "Un paquet ne doit jamais importer apps/server.",
      severity: "error",
      from: { path: `^${scope}/` },
      to: { path: "^apps/server/" },
    },
    // RI7 : aucune dépendance circulaire.
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
