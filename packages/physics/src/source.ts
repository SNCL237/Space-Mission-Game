// RI8 : toute valeur issue d'une source publique porte `source` (+ `urlSource` quand elle existe).

/** Grandeur documentée : valeur + provenance (RI8, `Agent.md`). */
export interface Source<V> {
  readonly valeur: V;
  readonly source: string;
  readonly urlSource?: string;
}
