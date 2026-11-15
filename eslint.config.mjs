// @ts-check
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/data/**",
      ".opencode/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
    {
    files: ["**/*.cjs", "**/*.mjs"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { ecmaVersion: 2023, sourceType: "module" },
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Les domaines purs (domain/) n'ont pas le droit d'importer NestJS.
    files: [
      "packages/**/domain/**/*.ts",
      "packages/kernel/**/*.ts",
      "packages/contracts/**/*.ts",
      "packages/physics/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*"],
              message: "Import NestJS interdit dans les règles pures (frontière RI3).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // Déterminisme : les moteurs purs ne lisent ni l'aléatoire global ni l'horloge.
          selector: "MemberExpression[property.name='random'][object.name='Math']",
          message:
            "Math.random() interdit dans les moteurs — utiliser mulberry32(graine) de @smdg/kernel.",
        },
        {
          selector: "CallExpression[callee.property.name='now'][callee.object.name='Date']",
          message: "Date.now() interdit dans les moteurs — injecter l'horloge (RG déterminisme).",
        },
      ],
    },
  },
);
