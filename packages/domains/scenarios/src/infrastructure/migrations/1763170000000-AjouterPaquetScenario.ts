import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Création de `sce.paquet_scenario` (F2.9/F2.10, PT1) — idempotent
 * (`IF NOT EXISTS`) : le schéma `sce` est aussi créé ici pour ne pas dépendre
 * de `db/init` (CI sans volume d'initialisation).
 */
export class AjouterPaquetScenario1763170000000 implements MigrationInterface {
  name = "AjouterPaquetScenario1763170000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "sce"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sce"."paquet_scenario" (
        "scenario_id" text NOT NULL,
        "version" text NOT NULL,
        "donnees" jsonb NOT NULL,
        "importe_le" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("scenario_id", "version")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sce"."paquet_scenario"`);
  }
}
