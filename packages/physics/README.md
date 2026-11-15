# `@smdg/physics`

Formules **pures** (aucun import NestJS, RI3) pour la simulation : constantes de la Lune,
période orbitale, éclipse, contact sol (A4), Tsiolkovski et capacité de batterie.
Valeurs de référence : annexe B du `PLAN_PHASES_THE_LAST_LIGHT.md` (calculées, à relire
dans GMAT — `docs/QUESTIONS.md` Q-05).

| Fonction                                       | Test         |
| ---------------------------------------------- | ------------ |
| `muDepuisGxM()` vs `LUNE.muKm3s2`              | T1-04        |
| `periode(50)` / `periode(100)`                 | T1-05, T1-06 |
| `fractionEclipseMax`, `dureeEclipseMaxMin`     | T1-07        |
| `capaciteBatterieMin`                          | T1-08        |
| `contactSol` (A4 tel qu'écrit, HYPOTHESE Q-01) | T1-09        |
| `tsiolkovski`                                  | T1-11        |

## Usage

```bash
pnpm --filter @smdg/physics build
pnpm --filter @smdg/physics typecheck
pnpm --filter @smdg/physics test
```

Sortie double ESM (`dist/esm`) + CJS (`dist/cjs`, `package.json` `type: commonjs`).
