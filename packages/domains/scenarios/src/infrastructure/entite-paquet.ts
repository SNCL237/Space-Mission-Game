import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Table `sce.paquet_scenario` (PT1) : une ligne par couple
 * (scénario, version), le paquet complet en JSONB. Clé primaire composée ⇒
 * ré-import idempotent, versions multiples conservées.
 */
@Entity({ name: "paquet_scenario", schema: "sce" })
export class PaquetScenario {
  @PrimaryColumn({ name: "scenario_id", type: "text" })
  scenarioId!: string;

  @PrimaryColumn({ name: "version", type: "text" })
  version!: string;

  @Column({ type: "jsonb" })
  donnees!: unknown;

  @Column({ name: "importe_le", type: "timestamptz", default: () => "now()" })
  importeLe!: Date;
}
