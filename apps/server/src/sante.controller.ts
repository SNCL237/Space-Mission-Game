import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { ZodValidationPipe } from "./infra/zod-validation.pipe.js";

// Route d'essai : sert de cible aux contrôles P1 (T1-14 santé, T1-15 validation Zod).

const schemaEcho = z.object({ message: z.string().min(1) });

@ApiTags("sante")
@Controller("api/health")
export class SanteController {
  @Get()
  @ApiOperation({ summary: "Santé du serveur" })
  @ApiOkResponse({ description: "Le serveur répond." })
  sante(): { statut: string } {
    return { statut: "ok" };
  }

  @Post("echo")
  @HttpCode(200)
  @ApiOperation({ summary: "Route d'essai : corps validé par Zod (T1-15)" })
  @ApiOkResponse({ description: "Le corps validé, renvoyé tel quel." })
  echo(
    @Body(new ZodValidationPipe(schemaEcho)) corps: z.output<typeof schemaEcho>,
  ): z.output<typeof schemaEcho> {
    return corps;
  }
}
