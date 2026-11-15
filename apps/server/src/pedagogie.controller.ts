import { Controller, Get, HttpException, Inject, Param, Query } from "@nestjs/common";
import {
  CODES_EXPLICATION_TOUTES,
  schemaLangue,
} from "@smdg/contracts";
import { ServicePedagogie } from "@smdg/pedagogie";
import { ApiOperation, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

const schemaCode = z.string().min(1).max(128);
const schemaLangueQuery = z.object({ langue: schemaLangue.default("fr") }).strict();

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

@ApiTags("pedagogie")
@Controller("api/pedagogie")
export class PedagogieController {
  constructor(
    @Inject(ServicePedagogie) private readonly service: ServicePedagogie,
  ) {}

  @Get("glossaire")
  @ApiOperation({ summary: "Lire le glossaire dans la langue choisie" })
  @ApiOkResponse({ description: "Termes et définitions bilingues." })
  glossaire(@Query() query: unknown) {
    const { langue } = parser(schemaLangueQuery, query);
    return this.service.glossaire(langue);
  }

  @Get("codes/:code")
  @ApiOperation({ summary: "Rendre un code d'explication C7" })
  @ApiOkResponse({ description: "Titre, cause et piste dans la langue choisie." })
  rendre(@Param("code") code: string, @Query() query: unknown) {
    const codeValide = parser(schemaCode, code);
    const { langue } = parser(schemaLangueQuery, query);
    if (!CODES_EXPLICATION_TOUTES.includes(codeValide)) {
      throw new HttpException(
        { code: "CODE_EXPLICATION_INCONNU", params: { code: codeValide }, statut: 404 },
        404,
      );
    }
    return this.service.rendre(codeValide, langue);
  }
}
