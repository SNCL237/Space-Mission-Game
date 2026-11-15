import type { CodeExplication } from "@smdg/contracts";

export class ErreurIdentite extends Error {
  constructor(
    readonly explication: CodeExplication,
    readonly statut: number,
  ) {
    super(explication.code);
    this.name = "ErreurIdentite";
  }
}
