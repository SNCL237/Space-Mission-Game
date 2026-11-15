import { DataSource } from "typeorm";

import { CreerCampagne1763200000000 } from "./migrations/1763200000000-CreerCampagne.js";

const URL_POSTGRES_DEFAUT = "postgres://smdg:smdg@localhost:5433/smdg";

export function creerDataSourceCampagne(): DataSource {
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL ?? URL_POSTGRES_DEFAUT,
    migrations: [CreerCampagne1763200000000],
    migrationsRun: true,
    migrationsTableName: "migrations_cam",
  });
}
