import { DataSource } from "typeorm";

import { VersionCatalogue } from "./entite-version-catalogue.js";
import { AjouterVersionCatalogue1763160000000 } from "./migrations/1763160000000-AjouterVersionCatalogue.js";

// DataSource TypeORM du domaine catalogue (PT1) — **paresseuse** : elle n'est
// initialisée qu'à la première utilisation du dépôt, si bien que le
// démarrage de `AppModule` et les tests P1 (T1-14 → T1-17) ne dépendent
// d'aucune base vivante. `migrationsRun` applique la migration du domaine
// à la connexion (création `cat` + table, idempotente).

/**
 * URL par défaut alignée sur `docker-compose.yml` (smdg/smdg/smdg, port hôte
 * **5433** — Q-18 : le 5432 local est pris par un PostgreSQL système).
 * `DATABASE_URL` reste prioritaire (CI, réglages locaux).
 */
export const URL_POSTGRES_DEFAUT = "postgres://smdg:smdg@localhost:5433/smdg";

export function urlPostgres(): string {
  return process.env.DATABASE_URL ?? URL_POSTGRES_DEFAUT;
}

export function creerDataSourceCatalogue(): DataSource {
  return new DataSource({
    type: "postgres",
    url: urlPostgres(),
    entities: [VersionCatalogue],
    migrations: [AjouterVersionCatalogue1763160000000],
    migrationsRun: true,
  });
}
