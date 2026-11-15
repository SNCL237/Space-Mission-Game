import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  ROLES_KEY,
  schemaChoixCrise,
  schemaCommandeSimulation,
  schemaId,
  type RoleApi,
} from "@smdg/contracts";
import { z } from "zod";

import { ServiceCampagne } from "@smdg/campagne";
import { creerVueMission } from "./vue-mission.js";

const schemaCreation = z.object({
  scenarioId: schemaId,
  versionScenario: z.string().min(1),
  versionCatalogue: z.string().min(1),
  configurationId: schemaId,
  graine: z.number().int(),
});
const schemaActe = z.object({ acte: z.number().int().min(0).max(6) });
const schemaAvance = z.object({
  commandes: z.array(schemaCommandeSimulation),
  jours: z.number().int().positive(),
});
const schemaCrise = z.object({
  choix: schemaChoixCrise,
  cibleId: schemaId.optional(),
});
const schemaCloture = z.union([z.undefined(), z.object({}).strict()]);
const schemaPagination = z
  .object({
    limite: z.coerce.number().int().min(1).max(100).default(20),
    curseur: z.string().optional(),
  })
  .strict();
const schemaCurseurJournal = z.string().regex(/^[1-9]\d*$/);

interface RequeteAuthentifiee {
  readonly utilisateur?: { readonly utilisateurId: string; readonly role: RoleApi };
}

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

function obtenirUtilisateur(requete: RequeteAuthentifiee): string {
  if (requete.utilisateur === undefined) {
    throw new HttpException({ code: "AUTH_REQUISE", params: {}, statut: 401 }, 401);
  }
  return requete.utilisateur.utilisateurId;
}

function obtenirIdMission(valeur: string): string {
  const parse = schemaId.safeParse(valeur);
  if (!parse.success) {
    throw new HttpException(
      { code: "ENTREE_INVALIDE", params: { champ: "missionId" }, statut: 400 },
      400,
    );
  }
  return parse.data;
}

@Controller("api/campagne")
@ApiTags("campagne")
@ApiBearerAuth()
@SetMetadata(ROLES_KEY, ["joueur"])
export class CampagneController {
  constructor(@Inject(ServiceCampagne) private readonly campagne: ServiceCampagne) {}

  @Get("scenarios")
  @ApiOperation({ summary: "Lister les scénarios disponibles pour le joueur" })
  @ApiOkResponse({ description: "Page de scénarios et conditions de déblocage." })
  async listerScenarios(
    @Query() query: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    const pagination = parser(schemaPagination, query);
    const scenarios = await this.campagne.listerScenarios(obtenirUtilisateur(requete));
    const indexCurseur =
      pagination.curseur === undefined
        ? -1
        : scenarios.findIndex((scenario) => scenario.scenarioId === pagination.curseur);
    if (pagination.curseur !== undefined && indexCurseur < 0) {
      throw new HttpException(
        { code: "ENTREE_INVALIDE", params: { champ: "curseur" }, statut: 400 },
        400,
      );
    }
    const page = scenarios.slice(indexCurseur + 1, indexCurseur + 1 + pagination.limite + 1);
    const hasMore = page.length > pagination.limite;
    const items = page.slice(0, pagination.limite);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.scenarioId ?? null) : null,
    };
  }

  @Post("missions")
  @ApiOperation({ summary: "Créer une mission" })
  @ApiResponse({ status: 201, description: "Mission créée." })
  creerMission(@Body() corps: unknown, @Req() requete: RequeteAuthentifiee) {
    const entree = parser(schemaCreation, corps);
    return this.campagne.creerMission({
      ...entree,
      missionId: randomUUID(),
      utilisateurId: obtenirUtilisateur(requete),
    });
  }

  @Get("missions")
  @ApiOperation({ summary: "Lister les sauvegardes du joueur" })
  @ApiOkResponse({ description: "Page de missions triée par identifiant." })
  listerMissions(
    @Query() query: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    const pagination = parser(schemaPagination, query);
    if (pagination.curseur !== undefined) parser(schemaId, pagination.curseur);
    return this.campagne.listerMissions(
      obtenirUtilisateur(requete),
      pagination.limite,
      pagination.curseur,
    );
  }

  @Get("missions/:missionId")
  @ApiOperation({ summary: "Lire une mission appartenant au joueur" })
  @ApiOkResponse({ description: "Mission et journal." })
  lireMission(@Param("missionId") missionId: string, @Req() requete: RequeteAuthentifiee) {
    return this.campagne.lireMission(obtenirUtilisateur(requete), obtenirIdMission(missionId));
  }

  @Get("missions/:missionId/journal")
  @ApiOperation({ summary: "Lire une page du journal append-only de la mission" })
  @ApiOkResponse({ description: "Page de décisions ordonnée par séquence." })
  lireJournal(
    @Param("missionId") missionId: string,
    @Query() query: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    const pagination = parser(schemaPagination, query);
    if (pagination.curseur !== undefined) {
      parser(schemaCurseurJournal, pagination.curseur);
    }
    return this.campagne.lirePageJournal(
      obtenirUtilisateur(requete),
      obtenirIdMission(missionId),
      pagination.limite,
      pagination.curseur,
    );
  }

  @Get("missions/:missionId/reprise")
  @ApiOperation({ summary: "Reprendre une sauvegarde et vérifier ses versions épinglées" })
  @ApiOkResponse({ description: "Sauvegarde avec son journal." })
  reprendre(@Param("missionId") missionId: string, @Req() requete: RequeteAuthentifiee) {
    return this.campagne.reprendre(obtenirUtilisateur(requete), obtenirIdMission(missionId));
  }

  @Get("missions/:missionId/vue")
  @ApiOperation({ summary: "Générer la vue de mission destinée à la visualisation" })
  @ApiOkResponse({ description: "Concept, trajectoire, chronologie et données 3D." })
  async vue(@Param("missionId") missionId: string, @Req() requete: RequeteAuthentifiee) {
    const mission = await this.campagne.lireMission(
      obtenirUtilisateur(requete),
      obtenirIdMission(missionId),
    );
    return creerVueMission(mission, mission.journal);
  }

  @Post("missions/:missionId/actes")
  @ApiOperation({ summary: "Avancer d'un acte de campagne" })
  @ApiResponse({ status: 201, description: "Acte traité." })
  avancerActe(
    @Param("missionId") missionId: string,
    @Body() corps: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    return this.campagne.avancerActe(
      obtenirUtilisateur(requete),
      obtenirIdMission(missionId),
      parser(schemaActe, corps).acte,
    );
  }

  @Post("missions/:missionId/simulation")
  @ApiOperation({ summary: "Avancer la simulation et enregistrer les commandes" })
  @ApiResponse({ status: 201, description: "Nouvel état de mission sauvegardé." })
  avancerSimulation(
    @Param("missionId") missionId: string,
    @Body() corps: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    const entree = parser(schemaAvance, corps);
    return this.campagne.avancerSimulation(
      obtenirUtilisateur(requete),
      obtenirIdMission(missionId),
      entree.commandes,
      entree.jours,
    );
  }

  @Post("missions/:missionId/crise")
  @ApiOperation({ summary: "Enregistrer une décision de crise" })
  @ApiResponse({ status: 201, description: "Décision enregistrée." })
  deciderCrise(
    @Param("missionId") missionId: string,
    @Body() corps: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    const entree = parser(schemaCrise, corps);
    return this.campagne.deciderCrise(
      obtenirUtilisateur(requete),
      obtenirIdMission(missionId),
      entree.choix,
      entree.cibleId,
    );
  }

  @Post("missions/:missionId/cloturer")
  @ApiOperation({ summary: "Clôturer et évaluer une mission" })
  @ApiResponse({ status: 201, description: "Bilan recalculé par le serveur." })
  cloturer(
    @Param("missionId") missionId: string,
    @Body() corps: unknown,
    @Req() requete: RequeteAuthentifiee,
  ) {
    parser(schemaCloture, corps);
    return this.campagne.cloturer(obtenirUtilisateur(requete), obtenirIdMission(missionId));
  }
}
