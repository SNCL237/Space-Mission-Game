import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Table `cat.version_catalogue` (PT1) : une ligne par version importée, le
 * document **domaine** complet en JSONB — les anciennes versions restent
 * lisibles via C1 (F2.3, T2-04). Clé primaire `version` ⇒ import idempotent.
 */
@Entity({ name: "version_catalogue", schema: "cat" })
export class VersionCatalogue {
  @PrimaryColumn({ name: "version", type: "text" })
  version!: string;

  @Column({ type: "jsonb" })
  donnees!: unknown;

  @Column({ name: "importe_le", type: "timestamptz", default: () => "now()" })
  importeLe!: Date;
}
