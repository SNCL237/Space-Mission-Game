import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  SetMetadata,
} from "@nestjs/common";
import {
  CONCEPTION_PORT,
  ROLES_KEY,
  schemaDifficulte,
  schemaId,
  schemaProfilOperations,
  type RoleApi,
} from "@smdg/contracts";
import { ServiceConception } from "@smdg/conception";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

interface RequeteAuthentifiee {
  readonly utilisateur?: { readonly utilisateurId: string; readonly role: RoleApi };
}

const schemaCreation = z
  .object({
    configurationId: schemaId,
    scenarioId: schemaId,
    versionScenario: z.string().min(1),
    versionCatalogue: z.string().min(1),
    budgetMaxMUSD: z.number().positive(),
    deltaVms: z.number().nonnegative(),
    margeDv: z.number().nonnegative(),
    dureeMissionAns: z.number().nonnegative(),
    coutOperationsAnnuelMUSD: z.number().nonnegative(),
    profondeurDecharge: z.number().positive().max(1),
    rendement: z.number().positive().max(1),
    tempsObservationSParJour: z.number().nonnegative(),
    difficulte: schemaDifficulte,
    profilOperations: schemaProfilOperations.optional(),
  })
  .strict();

const schemaModification = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("objectifs"),
      principal: schemaId.optional(),
      secondaires: z.array(schemaId),
    })
    .strict(),
  z
    .object({ type: z.literal("lancement"), lanceurId: schemaId, orbiteId: schemaId })
    .strict(),
  z.object({ type: z.literal("ajouter-element"), id: schemaId }).strict(),
  z.object({ type: z.literal("retirer-element"), id: schemaId }).strict(),
  z.object({ type: z.literal("ajouter-instrument"), id: schemaId }).strict(),
  z
    .object({
      type: z.literal("associer-objectifs-instrument"),
      id: schemaId,
      objectifs: z.array(schemaId).min(1),
    })
    .strict(),
  z.object({ type: z.literal("retirer-instrument"), id: schemaId }).strict(),
  z.object({ type: z.literal("marge-dv"), margeDv: z.number().nonnegative() }).strict(),
]);

function parser<T>(schema: z.ZodType<T>, valeur: unknown): T {
  const resultat = schema.safeParse(valeur);
  if (!resultat.success) {
    throw new HttpException(
      {
        code: "ENTREE_INVALIDE",
        params: {
          champs: resultat.error.issues.map((issue) => issue.path.map(String).join(".")).join(","),
        },
        statut: 400,
      },
      400,
    );
  }
  return resultat.data;
}

function idConfiguration(valeur: string): string {
  const resultat = schemaId.safeParse(valeur);
  if (!resultat.success) {
    throw new HttpException(
      { code: "ENTREE_INVALIDE", params: { champ: "configurationId" }, statut: 400 },
      400,
    );
  }
  return resultat.data;
}

function exigerJoueur(requete: RequeteAuthentifiee): void {
  if (requete.utilisateur === undefined) {
    throw new HttpException({ code: "AUTH_REQUISE", params: {}, statut: 401 }, 401);
  }
}

@ApiTags("conception")
@ApiBearerAuth()
@Controller("api/conception")
@SetMetadata(ROLES_KEY, ["joueur"])
export class ConceptionController {
  constructor(
    @Inject(CONCEPTION_PORT) private readonly conception: ServiceConception,
  ) {}

  @Post("configurations")
  @ApiOperation({ summary: "Créer une configuration de mission" })
  @ApiResponse({ status: 201, description: "Configuration créée avec bilans et options." })
  @ApiResponse({ status: 400, description: "Paramètres invalides." })
  async creer(@Body() corps: unknown, @Req() requete: RequeteAuthentifiee) {
    exigerJoueur(requete);
    const entree = parser(schemaCreation, corps);
    const { profilOperations, ...parametres } = entree;
    await this.conception.creer(
      profilOperations === undefined ? parametres : { ...parametres, profilOperations },
    );
    return this.conception.lire(entree.configurationId);
  }

  @Get("configurations/:configurationId")
  @ApiOperation({ summary: "Lire bilans, seuils, alertes et options de conception" })
  @ApiResponse({ status: 200, description: "État de conception calculé par CON." })
  @ApiResponse({ status: 404, description: "Configuration inconnue." })
  lire(@Param("configurationId") configurationId: string, @Req() requete: RequeteAuthentifiee) {
    exigerJoueur(requete);
    return this.conception.lire(idConfiguration(configurationId));
  }

  @Patch("configurations/:configurationId")
  @ApiOperation({ summary: "Modifier une configuration de mission" })
  @ApiResponse({ status: 200, description: "Configuration modifiée." })
  @ApiResponse({ status: 400, description: "Modification invalide." })
  modifier(
    @Param("configurationId") configurationId: string,
    @Body() corps: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    exigerJoueur(requete);
    const id = idConfiguration(configurationId);
    const modification = parser(schemaModification, corps);
    if (modification.type === "objectifs") {
      if (modification.principal === undefined) {
        this.conception.modifier(id, {
          type: "objectifs",
          secondaires: modification.secondaires,
        });
      } else {
        this.conception.modifier(id, {
          type: "objectifs",
          principal: modification.principal,
          secondaires: modification.secondaires,
        });
      }
    } else {
      this.conception.modifier(id, modification);
    }
    return this.conception.lire(id);
  }

  @Post("configurations/:configurationId/figer")
  @ApiOperation({ summary: "Valider puis figer la configuration C3" })
  @ApiResponse({ status: 201, description: "Configuration C3 figée." })
  @ApiResponse({ status: 422, description: "Configuration invalide avec codes bloquants." })
  async figer(
    @Param("configurationId") configurationId: string,
    @Req() requete: RequeteAuthentifiee,
  ) {
    exigerJoueur(requete);
    const id = idConfiguration(configurationId);
    await this.conception.valider(id);
    return this.conception.figer(id);
  }
}
