import { HttpException, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  BusEvenements,
  ChargeEvenement,
  EvenementDomaine,
  NomEvenement,
} from "@smdg/contracts";
import { schemaEvenementDomaine } from "@smdg/contracts";

/**
 * Implémentation du port `EVENT_BUS` (C9) sur `@nestjs/event-emitter` :
 * toute charge passée à `publier` est validée par le schéma C9 et **refusée**
 * si elle est invalide (T1-17).
 */
@Injectable()
export class BusEvenementsNest implements BusEvenements {
  private readonly emetteur: EventEmitter2;

  constructor(@Inject(EventEmitter2) emetteur: EventEmitter2) {
    this.emetteur = emetteur;
  }

  publier(evenement: EvenementDomaine): void {
    const resultat = schemaEvenementDomaine.safeParse(evenement);
    if (!resultat.success) {
      const details = resultat.error.issues
        .map((issue) => `${issue.path.join(".") || "(racine)"}=${issue.code}`)
        .join("; ");
      // Erreur structurée `{ code, params, statut }` : le filtre la restitue telle quelle.
      throw new HttpException(
        {
          code: "CHARGE_EVENEMENT_INVALIDE",
          params: { details, nbIssues: resultat.error.issues.length },
          statut: 422,
        },
        422,
      );
    }
    this.emetteur.emit(resultat.data.type, resultat.data);
  }

  souscrire<N extends NomEvenement>(
    nom: N,
    accueillir: (evenement: ChargeEvenement<N>) => void,
  ): () => void {
    const ecouteur = accueillir as unknown as (evenement: EvenementDomaine) => void;
    this.emetteur.on(nom, ecouteur);
    return () => {
      this.emetteur.off(nom, ecouteur);
    };
  }
}
