# @smdg/kernel

Noyau commun minimal (cahier de conception §5.1) : **identifiants**, **unités typées**
et **générateur déterministe**. Aucune dépendance, aucun import NestJS (frontière RI3).

## Contenu

| Module          | Rôle                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id.ts`         | `Id` (marque de type sur UUID v4), `nouvelId()`, `estId()`, `versId()`                                                        |
| `unites.ts`     | Scalaires étiquetés `massKg`, `powerW`, `dataMbps`, `energyWh`, `costMUSD`, `altitudeKm` + `ajouter` / `comparer` / `minimum` |
| `mulberry32.ts` | `mulberry32(graine)` — PRNG déterministe (A6, RG3) ; algorithme standard, emplacement en `HYPOTHESE (Q-15)`                   |

## Commandes

```powershell
pnpm --filter @smdg/kernel build      # ESM + CJS (PT5)
pnpm --filter @smdg/kernel typecheck
pnpm --filter @smdg/kernel test
```

## Frontières

N'importe jamais un domaine, `apps/server` ni `@nestjs/*` (RI2, RI3) ; fournit
`Id`, les unités et `mulberry32` aux paquets `contracts`, `physics` et aux domaines.
