# Checklists de phase

> Une phase n'est close que si **tous** ses critères sont verts. Chaque critère
> correspond à des identifiants de test (T*-**) traçables.

## P0 — Cadrage et outillage

- [ ] T0-01 : scripts racine présents (build, test, boundaries)
- [ ] T0-02 : arbre valide sans violation de frontière
- [ ] T0-03 : noyau → domaine rejeté (RI2)
- [ ] T0-04 : règle pure → `@nestjs/*` rejeté (RI3)
- [ ] T0-05 : domaine → domaine rejeté (RI1)
- [ ] T0-08 : TypeScript strict
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm boundaries`, `pnpm build` verts
- [ ] CI verte sur base vierge (`.github/workflows/ci.yml`)
- [ ] PostgreSQL démarre avec exactement les 10 schémas
- [ ] `docs/QUESTIONS.md` (Q-01 → Q-14) et `docs/nasa/SOURCES.md` présents

## P1 — Noyau (kernel, contrats, physique, squelette serveur)

- [x] T1-01 → T1-17 : contrats C1–C9 gelés (tests producteur/consommateur + instantanés)
- [x] T1-04 → T1-11 : valeurs de référence annexe B (période, éclipse, contact)
- [x] T1-13 : aucun `Math.random` / `Date.now` / `fetch` dans les paquets purs
- [x] `AppModule` démarre, `GET /api/health` = 200, erreurs `{ code, params, statut }`

## P2 — Catalogue + Scénarios

- [x] T2-01 → T2-17 : schémas `reference`/`gameplay`/`missionsReelles`, A11, import idempotent
  - Vérifications : tests catalogue (8), scénarios (14) et routes d'administration (4) verts, PostgreSQL inclus.
  - T2-03 : URL distinctes consultées le 2026-11-15 ; résultats et réserves consignés dans `docs/nasa/SOURCES.md`.

## P3 — Conception

- [x] T3-01 → T3-20 : A1, A2, A3, `figer()`, registre de codes, property test RG1
  - Vérifications : 22 tests CON et 86 tests monorepo réussis ; build, typecheck, lint, format et frontières réussis.
  - C1/C3 étendus de façon rétrocompatible ; catalogue versionné en 1.1.0, sans écraser 1.0.0.

## P4 — Simulation

- [x] T4-01 → T4-19 : déterminisme, conservation des données, reprise, pureté

## P5 — Évaluation

- [x] T5-01 → T5-15 : score A7, fins A–D, causes chiffrées, `BilanMission`

## P6 — Campagne + Pédagogie + Identité

- [x] T6-01 → T6-16 : actes 0→VI, déblocage A10, codes fr/en, contrôle d'accès, e2e
  - Vérifications : CAM (7 unitaires + PostgreSQL), IDE (3 unitaires + PostgreSQL), PED (2), serveur (15) ; builds, typechecks, lint, format et frontières réussis.

## P7 — API complète

- [x] T7-01 → T7-14 : OpenAPI, erreurs, sécurité, anti-triche, `VueMission`, parité ESM/CJS
  - Vérifications : 29 opérations OpenAPI documentées ; 27 tests serveur réussis, dont parcours HTTP PostgreSQL, réponses 400/401/403/404/409/422/500, pagination, anti-triche, sécurité HTTP, WebSocket, `VueMission` et parité ESM/CJS.
  - Simulation (20), scénarios (14) et physique/GMAT (9) réussis ; build et typecheck serveur réussis.

## P9 — Intégration, qualité, sécurité

- [ ] T9-01 → T9-1x : traçabilité, calibrage, migrations, Dockerfile, charge

## P10 (V2) — Équipe, P11 (V3) — Classement

- [ ] T10-01 → T10-14, T11-01 → T11-10
