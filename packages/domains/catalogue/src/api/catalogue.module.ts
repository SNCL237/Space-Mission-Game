import { Module } from "@nestjs/common";
import { CATALOGUE_PORT } from "@smdg/contracts";

import { ImporterCatalogue } from "../application/importer-catalogue.js";
import { DEPOT_CATALOGUE } from "../domain/depot.js";
import { DepotCatalogueTypeorm } from "../infrastructure/depot-typeorm-catalogue.js";
import { CatalogueController } from "./catalogue.controller.js";

/**
 * Module du domaine catalogue (F2.1 → F2.4) : exporte le port `CATALOGUE_PORT`
 * pour les consommateurs (CON, SCE — liaison par jeton, RI1) ; l'écriture
 * (import) passe par `ImporterCatalogue` / `DEPOT_CATALOGUE` en interne.
 * Aucune connexion n'est ouverte au montage (DataSource paresseuse).
 */
@Module({
  controllers: [CatalogueController],
  providers: [
    DepotCatalogueTypeorm,
    ImporterCatalogue,
    { provide: DEPOT_CATALOGUE, useExisting: DepotCatalogueTypeorm },
    { provide: CATALOGUE_PORT, useExisting: DepotCatalogueTypeorm },
  ],
  exports: [CATALOGUE_PORT],
})
export class CatalogueModule {}
