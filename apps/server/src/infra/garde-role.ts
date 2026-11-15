import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ROLES_KEY,
  VERIFICATEUR_JWT_PORT,
  type IdentiteJeton,
  type PortVerificateurJwt,
} from "@smdg/contracts";

// Garde de rôle global : les routes marquées exigent un Bearer JWT valide.
// Sans métadonnée ROLES_KEY, la route reste publique.

/** Réponse HTTP minimale, sans dépendre des types Express. */
interface RequeteAvecRole {
  headers: Record<string, string | string[] | undefined>;
  utilisateur?: IdentiteJeton;
}

function premierValeur(entete: string | string[] | undefined): string | undefined {
  if (Array.isArray(entete)) return entete[0];
  return entete;
}

@Injectable()
export class GardeRole implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflecteur: Reflector,
    @Inject(VERIFICATEUR_JWT_PORT) private readonly verificateur: PortVerificateurJwt,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflecteur.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) {
      return true; // Route publique (health, OpenAPI, …).
    }
    const requete = context.switchToHttp().getRequest<RequeteAvecRole>();
    const autorisation = premierValeur(requete.headers["authorization"]);
    const correspondance = autorisation?.match(/^Bearer\s+([^\s]+)$/i);
    if (correspondance === undefined || correspondance === null) {
      throw new HttpException({ code: "AUTH_REQUISE", params: {}, statut: 401 }, 401);
    }
    const identite = await this.verificateur.verifier(correspondance[1]!);
    requete.utilisateur = identite;
    if (!roles.includes(identite.role)) {
      throw new HttpException(
        {
          code: "ROLE_INTERDIT",
          params: { role: identite.role, attendu: roles.join("|") },
          statut: 403,
        },
        403,
      );
    }
    return true;
  }
}
