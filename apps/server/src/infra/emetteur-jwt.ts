import { Inject, Injectable } from "@nestjs/common";
import { SignJWT } from "jose";
import type { PortEmetteurJwt } from "@smdg/contracts";

import { CONFIGURATION_VALIDEE, type ConfigurationServeur } from "./config.zod.js";

@Injectable()
export class EmetteurJwt implements PortEmetteurJwt {
  private readonly cle: Uint8Array;

  constructor(@Inject(CONFIGURATION_VALIDEE) configuration: ConfigurationServeur) {
    this.cle = new TextEncoder().encode(configuration.JWT_SECRET);
  }

  async emettre(entree: {
    readonly utilisateurId: string;
    readonly role: "admin" | "joueur";
    readonly dureeSecondes: number;
  }): Promise<string> {
    return new SignJWT({ role: entree.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(entree.utilisateurId)
      .setIssuedAt()
      .setExpirationTime(`${entree.dureeSecondes}s`)
      .sign(this.cle);
  }
}
