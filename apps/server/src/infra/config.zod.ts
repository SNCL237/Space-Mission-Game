import { z } from "zod";

// Configuration du serveur (transverse, `Agent.md` §10) : validation Zod de
// l'environnement au démarrage. Toute variable obligatoire manquante fait échouer
// le démarrage en nommant la variable (T1-16).

/** Échec de configuration : le message cite le(s) nom(s) de variable(s). */
export class ErreurConfiguration extends Error {
  constructor(nomsVariables: readonly string[]) {
    super(
      `CONFIG_INVALIDE — variable(s) d'environnement obligatoire(s) ou invalide(s) : ${nomsVariables.join(", ")}`,
    );
    this.name = "ErreurConfiguration";
  }
}

export const schemaConfiguration = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origines CORS autorisées, séparées par des virgules — jamais de « * » (F7.7). */
  CORS_ORIGINS: z
    .string()
    .min(1)
    .refine((valeur) => !valeur.split(",").some((origine) => origine.trim() === "*"), {
      message: "CORS_ORIGINS ne doit jamais contenir « * » (F7.7)",
    }),
  JWT_SECRET: z.string().min(32),
});

/** Configuration serveur déjà validée et typée. */
export type ConfigurationServeur = z.output<typeof schemaConfiguration>;

/** Jeton du provider portant la configuration validée. */
export const CONFIGURATION_VALIDEE = "CONFIGURATION_VALIDEE";

/**
 * Valide `process.env` ; lève `ErreurConfiguration` en citant les variables
 * manquantes ou invalides (T1-16).
 */
export function validerConfiguration(entree: NodeJS.ProcessEnv): ConfigurationServeur {
  const resultat = schemaConfiguration.safeParse(entree);
  if (!resultat.success) {
    const noms = [
      ...new Set(resultat.error.issues.map((issue) => String(issue.path[0] ?? "(inconnue)"))),
    ];
    throw new ErreurConfiguration(noms);
  }
  return resultat.data;
}
