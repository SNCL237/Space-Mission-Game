import { Injectable } from "@nestjs/common";
import type { Langue, PortPedagogie } from "@smdg/contracts";

import {
  GLOSSAIRE,
  rendreExplication,
  verifierCouvertureExplications,
} from "../domain/explications.js";

@Injectable()
export class ServicePedagogie implements PortPedagogie {
  rendre(code: string, langue: Langue) {
    return rendreExplication(code, langue);
  }

  glossaire(langue: Langue) {
    return GLOSSAIRE[langue];
  }

  verifierCouverture(): readonly string[] {
    return verifierCouvertureExplications();
  }
}
