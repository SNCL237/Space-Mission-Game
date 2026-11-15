import { Injectable } from "@nestjs/common";

import type { PortScenarios } from "@smdg/contracts";
import type { DepotScenarios, SituationScenario } from "../domain/depot.js";
import type { PaquetScenarioSc } from "../domain/schema-paquet.js";
import { PaquetScenario } from "./entite-paquet.js";
import { creerDataSourceScenarios } from "./source-typeorm.js";
import { schemaPaquetScenarioSc } from "../domain/schema-paquet.js";
import type { DataSource } from "typeorm";

/**
 * Dépôt TypeORM des scénarios (PT1) : écriture d'import idempotente par
 * `(scenario_id, version)` et lectures du contexte A11. Connexion établie
 * **lazily** au premier appel — voir `source-typeorm.ts`.
 */
@Injectable()
export class DepotScenariosTypeorm implements DepotScenarios, PortScenarios {
  private connexion?: Promise<DataSource>;

  private source(): Promise<DataSource> {
    this.connexion ??= (async () => {
      const source = creerDataSourceScenarios();
      await source.initialize();
      return source;
    })();
    return this.connexion;
  }

  async enregistrer(paquet: PaquetScenarioSc): Promise<void> {
    const source = await this.source();
    await source.getRepository(PaquetScenario).save({
      scenarioId: paquet.id,
      version: paquet.version,
      donnees: paquet,
    });
  }

  async listerIds(): Promise<string[]> {
    const source = await this.source();
    const lignes = await source
      .getRepository(PaquetScenario)
      .find({ select: { scenarioId: true }, order: { scenarioId: "ASC" } });
    return [...new Set(lignes.map((ligne) => ligne.scenarioId))];
  }

  async listerSituations(): Promise<SituationScenario[]> {
    const source = await this.source();
    const lignes = await source.getRepository(PaquetScenario).find({
      select: { scenarioId: true, donnees: true },
      order: { scenarioId: "ASC" },
    });
    // Un même scénario peut avoir plusieurs versions : la plus récente lisible
    // suffit pour les arêtes (dé-doublonné par identifiant, première ligne).
    const vus = new Set<string>();
    const situations: SituationScenario[] = [];
    for (const ligne of lignes) {
      if (vus.has(ligne.scenarioId)) continue;
      vus.add(ligne.scenarioId);
      const parse = schemaPaquetScenarioSc.safeParse(ligne.donnees);
      const prerequis = parse.success
        ? parse.data.conditionsDeblocage
            .filter((condition) => condition.type === "prerequis")
            .map((condition) => condition.scenarioPrerequis as string)
        : [];
      situations.push({ id: ligne.scenarioId, prerequis });
    }
    return situations;
  }

  async lire(scenarioId: string, version: string): Promise<PaquetScenarioSc | undefined> {
    const source = await this.source();
    const ligne = await source.getRepository(PaquetScenario).findOneBy({ scenarioId, version });
    if (ligne === null) return undefined;
    // Re-validation à la lecture : un paquet stocké reste un C2 valide.
    const parse = schemaPaquetScenarioSc.safeParse(ligne.donnees);
    if (!parse.success) {
      throw new Error(`PAQUET_STOCKE_INVALIDE — scénario ${scenarioId} version ${version}`);
    }
    return parse.data;
  }

  async lister(): Promise<readonly { id: string; version: string; ordre: number }[]> {
    const source = await this.source();
    const lignes = await source
      .getRepository(PaquetScenario)
      .find({ select: { scenarioId: true, version: true, donnees: true } });
    const resultats = lignes.map((ligne) => {
      const parse = schemaPaquetScenarioSc.safeParse(ligne.donnees);
      if (!parse.success) {
        throw new Error(
          `PAQUET_STOCKE_INVALIDE — scénario ${ligne.scenarioId} version ${ligne.version}`,
        );
      }
      return { id: ligne.scenarioId, version: ligne.version, ordre: parse.data.ordre };
    });
    return resultats.sort(
      (a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id) || a.version.localeCompare(b.version),
    );
  }
}
