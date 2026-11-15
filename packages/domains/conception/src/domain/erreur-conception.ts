import type { CodeExplication } from "@smdg/contracts";

/** Erreur métier stable, exploitable par l'application et PED sans texte joueur. */
export class ErreurConception extends Error {
  constructor(
    readonly explication: CodeExplication,
    readonly statut = 422,
  ) {
    super(explication.code);
    this.name = "ErreurConception";
  }

  get code(): string {
    return this.explication.code;
  }

}
