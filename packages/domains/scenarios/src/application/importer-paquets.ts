import { Inject, Injectable } from "@nestjs/common";
import type { CodeExplication } from "@smdg/contracts";

import { DEPOT_SCENARIOS, type DepotScenarios } from "../domain/depot.js";
import { schemaPaquetScenarioSc, type PaquetScenarioSc } from "../domain/schema-paquet.js";
import { chargerPaquetsDepuisDisque } from "../infrastructure/source-donnees.js";
import { ValiderPaquet } from "./valider-paquet.js";

// F2.10 : import des paquets de scénarios depuis `data/<scenario>/paquet.json`
// — chaque paquet passe A11 ; la publication d'un paquet défaillant est
// refusée (erreurs listées), les autres paquets restent importables.

export interface RapportImportScenarios {
  /** Nombre de paquets publiés (0 si tous refusés). */
  readonly publie: number;
  readonly erreurs: CodeExplication[];
}

@Injectable()
export class ImporterPaquets {
  constructor(
    @Inject(ValiderPaquet) private readonly valider: ValiderPaquet,
    @Inject(DEPOT_SCENARIOS) private readonly depot: DepotScenarios,
  ) {}

  /** Importe tous les paquets du disque ; un défaut n'empêche pas les autres. */
  async importerTout(): Promise<RapportImportScenarios> {
    let paquets: { fichier: string; brut: unknown }[];
    try {
      paquets = chargerPaquetsDepuisDisque();
    } catch (erreur) {
      return {
        publie: 0,
        erreurs: [
          {
            version: 1,
            code: "PAQUET_CHARGEMENT_IMPOSSIBLE",
            params: { message: erreur instanceof Error ? erreur.message : String(erreur) },
          },
        ],
      };
    }

    let publie = 0;
    const erreurs: CodeExplication[] = [];
    for (const { fichier, brut } of paquets) {
      const rapport = await this.valider.valider(brut);
      if (!rapport.valide) {
        // Le contexte A11 s'applique aussi aux paquets voisins : chaque erreur
        // porte le fichier concerné (paramètre de diagnostic, pas un texte).
        for (const erreur of rapport.erreurs) {
          erreurs.push({ ...erreur, params: { ...erreur.params, fichier } });
        }
        continue;
      }
      const parse = schemaPaquetScenarioSc.safeParse(brut);
      if (!parse.success) continue; // Impossible : le rapport est déjà vide.
      await this.depot.enregistrer(parse.data as PaquetScenarioSc);
      publie += 1;
    }
    return { publie, erreurs };
  }
}
