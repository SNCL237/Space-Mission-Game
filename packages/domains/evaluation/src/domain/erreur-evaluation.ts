export class ErreurEvaluation extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, number | string> = {},
  ) {
    super(`${code}${Object.keys(params).length > 0 ? ` — ${JSON.stringify(params)}` : ""}`);
    this.name = "ErreurEvaluation";
  }
}
