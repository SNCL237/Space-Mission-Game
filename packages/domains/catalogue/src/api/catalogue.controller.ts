import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  SetMetadata,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CATALOGUE_PORT,
  ROLES_KEY,
  type PortCatalogue,
  type ReferentielCatalogue,
} from "@smdg/contracts";
import { z } from "zod";

import {
  ImporterCatalogue,
  type RapportImportCatalogue,
} from "../application/importer-catalogue.js";
import { chargerCatalogueDepuisDisque } from "../infrastructure/source-donnees.js";
import { PipeZod } from "./pipe-zod.js";

// Routes d'administration catalogue (F2.10) : toutes réservées au rôle
// `admin` (T2-16) — en-tête `x-role` provisoire, remplacé en P6 (JWT).

const schemaVersion = z.string().min(1);

@ApiTags("catalogue")
@ApiBearerAuth()
@Controller("api/catalogue")
export class CatalogueController {
  constructor(
    @Inject(CATALOGUE_PORT) private readonly port: PortCatalogue,
    @Inject(ImporterCatalogue) private readonly importateur: ImporterCatalogue,
  ) {}

  @Get("versions")
  @SetMetadata(ROLES_KEY, ["admin"])
  @ApiOperation({ summary: "Versions du catalogue importées (F2.2)" })
  @ApiOkResponse({ description: "Liste des versions, triées." })
  async listerVersions(): Promise<{ versions: string[] }> {
    return { versions: await this.port.listerVersions() };
  }

  @Get(":version")
  // B1 (audit) : l'atelier du joueur doit pouvoir lire le référentiel C1.
  @SetMetadata(ROLES_KEY, ["admin", "joueur"])
  @ApiOperation({ summary: "Référentiel C1 d'une version (F2.3)" })
  @ApiOkResponse({ description: "Document C1 de la version demandée." })
  async lire(
    @Param("version", new PipeZod(schemaVersion)) version: string,
  ): Promise<ReferentielCatalogue> {
    const referentiel = await this.port.lire(version);
    if (referentiel === undefined) {
      throw new HttpException(
        { code: "CATALOGUE_VERSION_INCONNUE", params: { version }, statut: 404 },
        404,
      );
    }
    return referentiel;
  }

  @Post("import")
  @HttpCode(200)
  @SetMetadata(ROLES_KEY, ["admin"])
  @ApiOperation({ summary: "Import du catalogue depuis les JSON du domaine (F2.2)" })
  @ApiOkResponse({ description: "Rapport { importe, erreurs } — refusé si erreur, rien stocké." })
  async importer(): Promise<RapportImportCatalogue> {
    try {
      return await this.importateur.importer(chargerCatalogueDepuisDisque());
    } catch (erreur) {
      // Chargement disque impossible : rapport structuré, jamais une 500 muette.
      return {
        importe: false,
        erreurs: [
          {
            version: 1,
            code: "CATALOGUE_CHARGEMENT_IMPOSSIBLE",
            params: { message: erreur instanceof Error ? erreur.message : String(erreur) },
          },
        ],
      };
    }
  }
}
