import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { ErreurApi } from "@smdg/contracts";

// Filtre d'exceptions global (transverse, `Agent.md` §10) : toute réponse d'erreur
// a la forme homogène `{ code, params, statut }` (Agent.md §11).

/** Réponse HTTP minimale, sans dépendance aux types Express. */
interface ReponseHttp {
  status(code: number): ReponseHttp;
  json(corps: unknown): unknown;
}

function estErreurApi(valeur: unknown): valeur is ErreurApi {
  if (typeof valeur !== "object" || valeur === null) return false;
  const candidate = valeur as Partial<ErreurApi>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.statut === "number" &&
    typeof candidate.params === "object" &&
    candidate.params !== null
  );
}

function versErreurApi(corps: unknown, statut: number): ErreurApi {
  // Les erreurs déjà structurées par nos pipes/contrôleurs passent telles quelles.
  if (estErreurApi(corps)) return corps;
  // Codes seuls, jamais de texte joueur (RI) : les paramètres restent structurés.
  const code =
    statut === 404 ? "ROUTE_INTROUVABLE" : statut >= 500 ? "ERREUR_INTERNE" : "ERREUR_HTTP";
  return { code, params: {}, statut };
}

function estErreurDomaine(valeur: unknown): valeur is {
  readonly explication: { readonly code: string; readonly params: Record<string, unknown> };
  readonly statut: number;
} {
  if (typeof valeur !== "object" || valeur === null) return false;
  const candidate = valeur as {
    readonly explication?: { readonly code?: unknown; readonly params?: unknown };
    readonly statut?: unknown;
  };
  return (
    typeof candidate.statut === "number" &&
    typeof candidate.explication?.code === "string" &&
    typeof candidate.explication.params === "object" &&
    candidate.explication.params !== null
  );
}

@Catch()
export class FiltreExceptions implements ExceptionFilter {
  private readonly logger = new Logger(FiltreExceptions.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reponse = host.switchToHttp().getResponse<ReponseHttp>();
    const statut =
      exception instanceof HttpException
        ? exception.getStatus()
        : estErreurDomaine(exception)
          ? exception.statut
          : 500;
    const corps =
      exception instanceof HttpException
        ? exception.getResponse()
        : estErreurDomaine(exception)
          ? {
              code: exception.explication.code,
              params: exception.explication.params,
              statut,
            }
          : undefined;
    // Journalisation (Agent.md §10) : jamais d'erreur silencieuse.
    if (statut >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    reponse.status(statut).json(versErreurApi(corps, statut));
  }
}
