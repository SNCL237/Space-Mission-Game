import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreerIdentite1763210000000 implements MigrationInterface {
  name = "CreerIdentite1763210000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "ide"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ide"."compte" (
        "utilisateur_id" uuid PRIMARY KEY,
        "pseudo" text NOT NULL,
        "identifiant_normalise" text NOT NULL UNIQUE,
        "courriel" text,
        "courriel_normalise" text UNIQUE,
        "mot_de_passe_hash" text,
        "langue" text NOT NULL CHECK ("langue" IN ('fr', 'en')),
        "invite" boolean NOT NULL,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        CHECK (("invite" AND "mot_de_passe_hash" IS NULL AND "courriel" IS NULL)
          OR (NOT "invite" AND "mot_de_passe_hash" IS NOT NULL))
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ide"."compte"`);
  }
}
