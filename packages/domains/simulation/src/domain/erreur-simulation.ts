import { CODES_SIMULATION, type CodeExplication } from "@smdg/contracts";

export class ErreurSimulation extends Error {
  readonly statut = 422;

  constructor(readonly explication: CodeExplication) {
    super(explication.code);
    this.name = "ErreurSimulation";
  }

  get code(): string {
    return this.explication.code;
  }
}

export function expliquerSimulation(
  code: (typeof CODES_SIMULATION)[keyof typeof CODES_SIMULATION],
  params: Record<string, number | string> = {},
): CodeExplication {
  return { version: 1, code, params };
}
