import { Injectable } from "@nestjs/common";
import type { PortCatalogue, ReferentielCatalogue } from "@smdg/contracts";
import type { DataSource } from "typeorm";

import type { DepotCatalogue } from "../domain/depot.js";
import { projeterVersC1Valide } from "../domain/projection.js";
import { schemaCatalogue, type DocumentCatalogue } from "../domain/schema-catalogue.js";
import { VersionCatalogue } from "./entite-version-catalogue.js";
import { creerDataSourceCatalogue } from "./source-typeorm.js";

/**
 * Dépôt TypeORM du catalogue (PT1) : implémente le dépôt du domaine
 * (écriture d'import) et le port consommateur C1 (lecture). La connexion est
 * établie **lazily** au premier appel — voir `source-typeorm.ts`.
 */
@Injectable()
export class DepotCatalogueTypeorm implements DepotCatalogue, PortCatalogue {
  private connexion?: Promise<DataSource>;

  private source(): Promise<DataSource> {
    this.connexion ??= (async () => {
      const source = creerDataSourceCatalogue();
      await source.initialize();
      return source;
    })();
    return this.connexion;
  }

  async enregistrer(document: DocumentCatalogue): Promise<void> {
    const source = await this.source();
    // Upsert sur la clé primaire `version` : ré-import sans doublon (T2-04).
    await source.getRepository(VersionCatalogue).save({
      version: document.version,
      donnees: document,
    });
  }

  async listerVersions(): Promise<string[]> {
    const source = await this.source();
    const lignes = await source
      .getRepository(VersionCatalogue)
      .find({ order: { version: "ASC" }, select: { version: true } });
    return lignes.map((ligne) => ligne.version);
  }

  async lireDocument(version: string): Promise<DocumentCatalogue | undefined> {
    const source = await this.source();
    const ligne = await source.getRepository(VersionCatalogue).findOneBy({ version });
    if (ligne === null) return undefined;
    // Re-validation à la lecture : une version reste lisible par C1 (F2.3).
    const parse = schemaCatalogue.safeParse(ligne.donnees);
    if (!parse.success) {
      throw new Error(`CATALOGUE_STOCKE_INVALIDE — version ${version}`);
    }
    return parse.data;
  }

  async listerIdentifiants(): Promise<string[]> {
    const source = await this.source();
    const lignes = await source.query<{ id: string }[]>(
      `SELECT "donnees"->>'id' AS id FROM "cat"."version_catalogue" ORDER BY "version"`,
    );
    return lignes.map((ligne) => ligne.id).filter((id): id is string => id !== null);
  }

  /** Lecture C1 (port consommateur) : document domaine → projection C1. */
  async lire(version: string): Promise<ReferentielCatalogue | undefined> {
    const document = await this.lireDocument(version);
    return document === undefined ? undefined : projeterVersC1Valide(document);
  }
}
