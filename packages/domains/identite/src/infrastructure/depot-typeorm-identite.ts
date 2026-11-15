import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { DataSource } from "typeorm";

import type { DepotIdentite } from "../domain/depot.js";
import type { CompteIdentite } from "../domain/types.js";
import type { Langue } from "@smdg/contracts";
import { creerDataSourceIdentite } from "./source-typeorm.js";

interface LigneCompte {
  readonly utilisateur_id: string;
  readonly pseudo: string;
  readonly identifiant_normalise: string;
  readonly courriel: string | null;
  readonly courriel_normalise: string | null;
  readonly mot_de_passe_hash: string | null;
  readonly langue: "fr" | "en";
  readonly invite: boolean;
}

@Injectable()
export class DepotIdentiteTypeorm implements DepotIdentite, OnModuleDestroy {
  private connexion: Promise<DataSource> | undefined;

  private source(): Promise<DataSource> {
    this.connexion ??= (async () => {
      const source = creerDataSourceIdentite();
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

  async creer(compte: CompteIdentite): Promise<boolean> {
    const source = await this.source();
    const lignes = (await source.query(
      `INSERT INTO "ide"."compte"
        ("utilisateur_id", "pseudo", "identifiant_normalise", "courriel",
         "courriel_normalise", "mot_de_passe_hash", "langue", "invite")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING "utilisateur_id"`,
      [
        compte.id,
        compte.pseudo,
        compte.identifiantNormalise,
        compte.courriel ?? null,
        compte.courrielNormalise ?? null,
        compte.motDePasseHash,
        compte.langue,
        compte.invite,
      ],
    )) as { utilisateur_id: string }[];
    return lignes.length === 1;
  }

  async trouverParIdentifiant(identifiantNormalise: string): Promise<CompteIdentite | undefined> {
    const source = await this.source();
    const lignes = (await source.query(
      `SELECT * FROM "ide"."compte"
       WHERE "identifiant_normalise" = $1 OR "courriel_normalise" = $1
       LIMIT 1`,
      [identifiantNormalise],
    )) as LigneCompte[];
    return lignes[0] === undefined ? undefined : this.compte(lignes[0]);
  }

  async trouverParId(utilisateurId: string): Promise<CompteIdentite | undefined> {
    const source = await this.source();
    const lignes = (await source.query(`SELECT * FROM "ide"."compte" WHERE "utilisateur_id" = $1`, [
      utilisateurId,
    ])) as LigneCompte[];
    return lignes[0] === undefined ? undefined : this.compte(lignes[0]);
  }

  async definirLangue(utilisateurId: string, langue: Langue): Promise<boolean> {
    const source = await this.source();
    const resultat = (await source.query(
      `UPDATE "ide"."compte" SET "langue" = $2 WHERE "utilisateur_id" = $1 RETURNING "utilisateur_id"`,
      [utilisateurId, langue],
    )) as [{ utilisateur_id: string }[], number];
    return resultat[0].length === 1;
  }

  private compte(ligne: LigneCompte): CompteIdentite {
    return {
      id: ligne.utilisateur_id,
      pseudo: ligne.pseudo,
      identifiantNormalise: ligne.identifiant_normalise,
      ...(ligne.courriel !== null ? { courriel: ligne.courriel } : {}),
      ...(ligne.courriel_normalise !== null ? { courrielNormalise: ligne.courriel_normalise } : {}),
      motDePasseHash: ligne.mot_de_passe_hash,
      langue: ligne.langue,
      invite: ligne.invite,
    };
  }
}
