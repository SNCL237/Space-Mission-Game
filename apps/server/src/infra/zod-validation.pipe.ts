import { HttpException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Pipe de validation Zod (transverse, `Agent.md` §10) : un corps invalide lève
 * `{ code, params, statut: 400 }` — enveloppe d'erreur C7 de l'API (T1-15).
 */
export class ZodValidationPipe implements PipeTransform {
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
