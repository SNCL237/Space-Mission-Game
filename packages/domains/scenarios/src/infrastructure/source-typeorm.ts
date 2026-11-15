import { DataSource } from "typeorm";

import { AjouterPaquetScenario1763170000000 } from "./migrations/1763170000000-AjouterPaquetScenario.js";
import { PaquetScenario } from "./entite-paquet.js";

// DataSource TypeORM du domaine scénarios (PT1) — **paresseuse** : initialisée
// uniquement à la première utilisation du dépôt, si bien que le montage de
// `AppModule` et les tests sans base restent verts (cf. catalogue, T1-14 →
// T1-17). `migrationsRun` crée `sce.paquet_scenario` au premier usage.

/** URL par défaut alignée sur `docker-compose.yml` (smdg/smdg/smdg :5433 — Q-18). */
export const URL_POSTGRES_DEFAUT = "postgres://smdg:smdg@localhost:5433/smdg";

export function urlPostgres(): string {
  return process.env.DATABASE_URL ?? URL_POSTGRES_DEFAUT;
}

export function creerDataSourceScenarios(): DataSource {
  return new DataSource({
    type: "postgres",
    url: urlPostgres(),
    entities: [PaquetScenario],
    migrations: [AjouterPaquetScenario1763170000000],
    migrationsRun: true,
  });
}
