import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { errors, jwtVerify } from "jose";
import { CONFIGURATION_VALIDEE, type ConfigurationServeur } from "./config.zod.js";
import type { IdentiteJeton, PortVerificateurJwt, RoleApi } from "@smdg/contracts";

function estRoleApi(role: unknown): role is RoleApi {
  return role === "admin" || role === "joueur";
}

@Injectable()
export class VerificateurJwt implements PortVerificateurJwt {
  private readonly cle: Uint8Array;

  constructor(@Inject(CONFIGURATION_VALIDEE) configuration: ConfigurationServeur) {
    this.cle = new TextEncoder().encode(configuration.JWT_SECRET);
  }

  async verifier(jeton: string): Promise<IdentiteJeton> {
    try {
      const { payload } = await jwtVerify(jeton, this.cle, {
        algorithms: ["HS256"],
        requiredClaims: ["sub", "iat", "exp", "role"],
      });
      if (payload.sub === undefined || !estRoleApi(payload.role)) {
        throw new UnauthorizedException({
          code: "JETON_INVALIDE",
          params: {},
          statut: 401,
        });
      }
      return { utilisateurId: payload.sub, role: payload.role };
    } catch (erreur: unknown) {
      if (erreur instanceof UnauthorizedException) throw erreur;
      if (erreur instanceof errors.JOSEError) {
        throw new UnauthorizedException({
          code: "JETON_INVALIDE",
          params: {},
          statut: 401,
        });
      }
      throw erreur;
    }
  }
}
