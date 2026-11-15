import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Création de `cat.version_catalogue` (F2.2, PT1) — un schéma par domaine,
 * migration portée par le domaine catalogue. Idempotent (`IF NOT EXISTS`) :
 * le schéma `cat` est aussi créé ici pour ne pas dépendre de `db/init`
 * (CI sans volume d'initialisation).
 */
export class AjouterVersionCatalogue1763160000000 implements MigrationInterface {
  name = "AjouterVersionCatalogue1763160000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "cat"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cat"."version_catalogue" (
        "version" text NOT NULL,
        "donnees" jsonb NOT NULL,
        "importe_le" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("version")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cat"."version_catalogue"`);
  }
}
