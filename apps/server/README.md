# `@smdg/server`

Racine de composition unique (RI5) — NestJS. Elle assemble CAT, SCE, CON, SIM,
EVA, CAM, PED et IDE via leurs modules et contrats.

## Ce que contient le squelette

- **Configuration** : `ConfigModule` + validation Zod (`src/infra/config.zod.ts`).
  Variables obligatoires : `CORS_ORIGINS` (origines CORS séparées par des virgules)
  et `JWT_SECRET` (clé HS256 d'au moins 32 caractères) ; `PORT` (défaut 3000) et
  `NODE_ENV` sont optionnels. Une variable manquante fait échouer le démarrage
  en la nommant (T1-16).
- **Pipe Zod** (`src/infra/zod-validation.pipe.ts`) : corps invalide →
  `{ code, params, statut: 400 }` (T1-15).
- **Filtre d'exceptions global** (`src/infra/exception.filter.ts`) : toute erreur
  répond `{ code, params, statut }` (Agent.md §11), codes seuls sans texte joueur.
- **`EVENT_BUS`** (`src/infra/event-bus.ts`) : implémentation C9 sur
  `@nestjs/event-emitter`, charges validées par Zod (T1-17).
- **JWT** (`src/infra/verificateur-jwt.ts`, `src/infra/emetteur-jwt.ts`) :
  émission et vérification HS256 ; les jetons portent `sub`, `role`
  (`admin` ou `joueur`), `iat` et `exp`. Les routes protégées exigent
  `Authorization: Bearer …` ; `x-role` n'accorde aucun accès.
- **SIM WebSocket** (`src/simulation.gateway.ts`) : espace `/simulation`,
  connexion authentifiée par `auth.token` et progression émise dans l'ordre.
  Événements entrants : `simulation.demarrer` (options C4),
  `simulation.avancer` (`commandes`, `jours`) et `simulation.decider`
  (`choix`, `cibleId` facultatif). Sorties : `simulation.progression` et
  `simulation.erreur`.
- **EVA** : `EvaluationModule` publie `BilanPublié` via C9 après calcul de C5 ;
  le score est recalculé côté serveur et une même mission ne publie pas deux
  bilans différents au cours de la durée de vie du service.
- **OpenAPI** (`src/openapi.ts`) : `/docs` (UI) et `/docs-json` (OpenAPI 3, T1-14).
- **Routes** : `GET /api/health` (T1-14), `POST /api/health/echo` (route d'essai, T1-15).
- **IDE** : `POST /api/identite/invites`, `/inscription`, `/connexion`,
  `GET /api/identite/profil` et `PATCH /api/identite/profil/langue`.
- **CAM** : routes sous `/api/campagne` pour lister les scénarios, créer et
  reprendre une mission, avancer les actes, exécuter des opérations et clôturer.
  Chaque mission et sauvegarde est filtrée par l'identifiant du propriétaire.
- **PED** : registre bilingue de C7 et glossaire français/anglais.

## Commandes

```bash
pnpm --filter @smdg/server build      # tsc → dist/
pnpm --filter @smdg/server typecheck
pnpm --filter @smdg/server test       # supertest sur AppModule
pnpm --filter @smdg/server start      # node dist/main.js (exige CORS_ORIGINS et JWT_SECRET)
```

## Règles d'or (décision PT2)

- **Pas d'`emitDecoratorMetadata`** (donc pas d'`unplugin-swc`) : Vitest + esbuild
  suffisent, mais **chaque paramètre constructeur de provider porte un
  `@Inject(JETON)` explicite** — sans lui, `nest can't resolve dependencies`
  au démarrage. `experimentalDecorators: true` est activé dans
  `tsconfig.base.json`.
- **Validation Zod sur 100 % des routes** (`Agent.md` §11) : tout paramètre
  `@Body` / `@Query` / `@Param` utilise `ZodValidationPipe`. Le caractère global
  de cette règle est vérifié par le test de couverture des routes en P7 (T7-01).
- `Date.now()` / `Math.random()` sont interdits dans les règles pures — voir
  `eslint.config.mjs` (déterminisme).
