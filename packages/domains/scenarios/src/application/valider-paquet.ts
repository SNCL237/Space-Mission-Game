import { Inject, Injectable } from "@nestjs/common";
import { CATALOGUE_PORT, type CodeExplication, type PortCatalogue } from "@smdg/contracts";

import { DEPOT_SCENARIOS, type DepotScenarios } from "../domain/depot.js";
import { validerPaquetA11 } from "../domain/validation-a11.js";

// F2.9 : cas d'usage « valider un paquet » — assemble le contexte A11 (CAT
// pour les identifiants du catalogue, dépôt SCE pour les arêtes de déblocage)
// et retourne la liste complète des erreurs. La lecture CAT passe par le port
// du contrat (RI1 : liaison par jeton, jamais par import de domaine).

export interface RapportValidation {
  readonly valide: boolean;
  readonly erreurs: CodeExplication[];
}

@Injectable()
export class ValiderPaquet {
  constructor(
    @Inject(CATALOGUE_PORT) private readonly catalogue: PortCatalogue,
    @Inject(DEPOT_SCENARIOS) private readonly depot: DepotScenarios,
  ) {}

  async valider(brut: unknown): Promise<RapportValidation> {
    const erreurs = validerPaquetA11(brut, {
      identifiantsCatalogue: await this.catalogue.listerIdentifiants(),
      scenariosConnus: await this.depot.listerSituations(),
    });
    return { valide: erreurs.length === 0, erreurs };
  }
}
