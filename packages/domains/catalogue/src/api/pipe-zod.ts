import { HttpException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Miroir de `apps/server/src/infra/zod-validation.pipe.ts` — la règle RI6
 * interdit d'importer `apps/server` depuis un paquet, donc chaque domaine
 * porte son propre pipe (même enveloppe `{ code, params, statut }`, C7).
 */
export class PipeZod implements PipeTransform {
  private readonly schema: ZodType;

  constructor(schema: ZodType) {
    this.schema = schema;
  }

  transform(valeur: unknown): unknown {
    const resultat = this.schema.safeParse(valeur);
    if (!resultat.success) {
      throw new HttpException(
        {
          code: "CORPS_REQUETE_INVALIDE",
          params: {
            champs: resultat.error.issues.map((issue) => issue.path.join(".") || "(racine)"),
          },
          statut: 400,
        },
        400,
      );
    }
    return resultat.data;
  }
}
