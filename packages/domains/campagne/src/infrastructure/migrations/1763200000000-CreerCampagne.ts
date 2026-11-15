import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreerCampagne1763200000000 implements MigrationInterface {
  name = "CreerCampagne1763200000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "cam"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cam"."mission" (
        "mission_id" uuid PRIMARY KEY,
        "utilisateur_id" uuid NOT NULL,
        "donnees" jsonb NOT NULL,
        "mise_a_jour_le" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cam"."progression" (
        "utilisateur_id" uuid NOT NULL,
        "scenario_id" uuid NOT NULL,
        "donnees" jsonb NOT NULL,
        "mise_a_jour_le" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("utilisateur_id", "scenario_id")
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cam"."journal_decision" (
        "sequence" bigserial PRIMARY KEY,
        "mission_id" uuid NOT NULL,
        "entree_id" uuid NOT NULL UNIQUE,
        "acte" smallint NOT NULL CHECK ("acte" BETWEEN 0 AND 6),
        "libelle" text NOT NULL,
        "effets" jsonb NOT NULL,
        "date" timestamptz NOT NULL
      )`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_decision_mission_sequence"
      ON "cam"."journal_decision" ("mission_id", "sequence")`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "cam"."interdire_modification_journal"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Le journal de campagne est append-only';
      END;
      $$`);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_journal_decision_append_only" ON "cam"."journal_decision"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_journal_decision_append_only"
      BEFORE UPDATE OR DELETE ON "cam"."journal_decision"
      FOR EACH ROW EXECUTE FUNCTION "cam"."interdire_modification_journal"()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cam"."journal_decision"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cam"."progression"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cam"."mission"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "cam"."interdire_modification_journal"()`);
  }
}
