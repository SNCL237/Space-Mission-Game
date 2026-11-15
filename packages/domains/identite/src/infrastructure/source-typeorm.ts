import { DataSource } from "typeorm";

import { CreerIdentite1763210000000 } from "./migrations/1763210000000-CreerIdentite.js";

export function creerDataSourceIdentite(): DataSource {
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL ?? "postgres://smdg:smdg@localhost:5433/smdg",
    migrations: [CreerIdentite1763210000000],
    migrationsRun: true,
    migrationsTableName: "migrations_ide",
  });
}
