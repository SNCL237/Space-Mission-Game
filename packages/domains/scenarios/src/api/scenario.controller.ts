import { Body, Controller, HttpCode, Inject, Post, SetMetadata } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLES_KEY } from "@smdg/contracts";
import { z } from "zod";

import { ImporterPaquets, type RapportImportScenarios } from "../application/importer-paquets.js";
import { ValiderPaquet, type RapportValidation } from "../application/valider-paquet.js";
import { PipeZod } from "./pipe-zod.js";

// Routes d'administration scénarios (F2.9/F2.10) : réservées au rôle `admin`
// (T2-16) — en-tête `x-role` provisoire, remplacé en P6 (JWT).

/**
 * Corps de `/valider` volontairement **lâche** (`z.record`) : c'est A11 qui
 * renvoie la liste complète des erreurs (T2-10), jamais un 400 prématuré.
 */
const schemaCorpsLibre = z.record(z.string(), z.unknown());

@ApiTags("scenarios")
@ApiBearerAuth()
@Controller("api/scenarios")
export class ScenarioController {
  constructor(
    // `@Inject` explicite : `emitDecoratorMetadata` est désactivé (voir
    // tsconfig.base.json) — l'injection par type de paramètre laisserait
    // `undefined` (erreur 500 « reading 'valider' »).
    @Inject(ValiderPaquet) private readonly serviceValider: ValiderPaquet,
    @Inject(ImporterPaquets) private readonly serviceImporter: ImporterPaquets,
  ) {}

  @Post("valider")
  @HttpCode(200)
  @SetMetadata(ROLES_KEY, ["admin"])
  @ApiOperation({ summary: "Valider un paquet de scénario (A11, F2.9)" })
  @ApiOkResponse({ description: "{ valide, erreurs[] } — toutes les erreurs en une fois." })
  async valider(
    @Body(new PipeZod(schemaCorpsLibre)) corps: Record<string, unknown>,
  ): Promise<RapportValidation> {
    return this.serviceValider.valider(corps);
  }

  @Post("import")
  @HttpCode(200)
  @SetMetadata(ROLES_KEY, ["admin"])
  @ApiOperation({ summary: "Importer tous les paquets data/ (A11, F2.10)" })
  @ApiOkResponse({ description: "{ publie, erreurs[] } — un défaut n'empêche pas les autres." })
  async importer(): Promise<RapportImportScenarios> {
    return this.serviceImporter.importerTout();
  }
}
