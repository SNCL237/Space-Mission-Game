import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { DataSource } from "typeorm";

import type { DepotCampagne } from "../domain/depot.js";
import type {
  EntreeJournal,
  MissionCampagne,
  PageResultat,
  ProgressionScenario,
} from "../domain/types.js";
import { creerDataSourceCampagne } from "./source-typeorm.js";

interface LigneJson<T> {
  readonly donnees: T;
}

interface LigneJournal extends Omit<EntreeJournal, "date"> {
  readonly date: string | Date;
}

interface LigneJournalPagine extends LigneJournal {
  readonly sequence: string | number;
}

@Injectable()
export class DepotCampagneTypeorm implements DepotCampagne, OnModuleDestroy {
  private connexion: Promise<DataSource> | undefined;

  private source(): Promise<DataSource> {
    this.connexion ??= (async () => {
      const source = creerDataSourceCampagne();
      await source.initialize();
      return source;
    })();
    return this.connexion;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connexion === undefined) return;
    const source = await this.connexion;
    if (source.isInitialized) await source.destroy();
    this.connexion = undefined;
  }

  async creerMission(mission: MissionCampagne): Promise<void> {
    const source = await this.source();
    await source.query(
      `INSERT INTO "cam"."mission" ("mission_id", "utilisateur_id", "donnees")
       VALUES ($1, $2, $3::jsonb)`,
      [mission.id, mission.utilisateurId, JSON.stringify(mission)],
    );
  }

  async lireMission(missionId: string): Promise<MissionCampagne | undefined> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT "donnees" FROM "cam"."mission" WHERE "mission_id" = $1`,
      [missionId],
    )) as LigneJson<MissionCampagne>[];
    return lignes[0]?.donnees;
  }

  async listerMissions(
    utilisateurId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<MissionCampagne>> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT "donnees" FROM "cam"."mission"
       WHERE "utilisateur_id" = $1 AND ($2::uuid IS NULL OR "mission_id" > $2::uuid)
       ORDER BY "mission_id" ASC
       LIMIT $3`,
      [utilisateurId, curseur ?? null, limite + 1],
    )) as LigneJson<MissionCampagne>[];
    const hasMore = lignes.length > limite;
    const items = lignes.slice(0, limite).map((ligne) => ligne.donnees);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async enregistrerMission(mission: MissionCampagne): Promise<void> {
    const source = await this.source();
    await source.query(
      `INSERT INTO "cam"."mission" ("mission_id", "utilisateur_id", "donnees")
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT ("mission_id") DO UPDATE
       SET "donnees" = EXCLUDED."donnees", "mise_a_jour_le" = now()
       WHERE "cam"."mission"."utilisateur_id" = EXCLUDED."utilisateur_id"`,
      [mission.id, mission.utilisateurId, JSON.stringify(mission)],
    );
  }

  async ajouterAuJournal(missionId: string, entree: EntreeJournal): Promise<void> {
    const source = await this.source();
    await source.query(
      `INSERT INTO "cam"."journal_decision"
        ("mission_id", "entree_id", "acte", "libelle", "effets", "date")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        missionId,
        entree.id,
        entree.acte,
        entree.libelle,
        JSON.stringify(entree.effets),
        entree.date,
      ],
    );
  }

  async lireJournal(missionId: string): Promise<readonly EntreeJournal[]> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT "entree_id" AS "id", "acte", "libelle", "effets", "date"
       FROM "cam"."journal_decision"
       WHERE "mission_id" = $1
       ORDER BY "sequence" ASC`,
      [missionId],
    )) as LigneJournal[];
    return lignes.map((ligne) => ({
      ...ligne,
      date:
        ligne.date instanceof Date ? ligne.date.toISOString() : new Date(ligne.date).toISOString(),
    }));
  }

  async lirePageJournal(
    missionId: string,
    limite: number,
    curseur?: string,
  ): Promise<PageResultat<EntreeJournal>> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT "sequence", "entree_id" AS "id", "acte", "libelle", "effets", "date"
       FROM "cam"."journal_decision"
       WHERE "mission_id" = $1 AND "sequence" > COALESCE($2::bigint, 0)
       ORDER BY "sequence" ASC
       LIMIT $3`,
      [missionId, curseur ?? null, limite + 1],
    )) as LigneJournalPagine[];
    const hasMore = lignes.length > limite;
    const page = lignes.slice(0, limite);
    return {
      items: page.map((ligne) => ({
        ...ligne,
        date:
          ligne.date instanceof Date ? ligne.date.toISOString() : new Date(ligne.date).toISOString(),
      })),
      nextCursor: hasMore ? String(page.at(-1)?.sequence ?? "") : null,
    };
  }

  async lireProgressions(utilisateurId: string): Promise<readonly ProgressionScenario[]> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT "donnees" FROM "cam"."progression" WHERE "utilisateur_id" = $1`,
      [utilisateurId],
    )) as LigneJson<ProgressionScenario>[];
    return lignes.map((ligne) => ligne.donnees);
  }

  async enregistrerProgression(progression: ProgressionScenario): Promise<void> {
    const source = await this.source();
    await source.query(
      `INSERT INTO "cam"."progression" ("utilisateur_id", "scenario_id", "donnees")
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT ("utilisateur_id", "scenario_id") DO UPDATE
       SET "donnees" = EXCLUDED."donnees", "mise_a_jour_le" = now()`,
      [progression.utilisateurId, progression.scenarioId, JSON.stringify(progression)],
    );
  }
}
