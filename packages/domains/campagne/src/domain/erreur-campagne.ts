import type { CodeExplication } from "@smdg/contracts";

export class ErreurCampagne extends Error {
  constructor(
    readonly explication: CodeExplication,
    readonly statut = 400,
  ) {
    super(explication.code);
    this.name = "ErreurCampagne";
  }
}
