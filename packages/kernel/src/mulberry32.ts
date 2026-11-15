// Générateur pseudo-aléatoire déterministe mulberry32 (A6, RG3).
// HYPOTHESE (Q-15) : l'emplacement de `mulberry32` dans `@smdg/kernel` n'est pas
// fixé par la documentation (le plan P1 le place explicitement dans le kernel).
// Algorithme standard mulberry32 (domaine public) : même graine ⇒ même suite.

/**
 * Retourne une fonction sans état externe produisant une suite déterministe
 * de nombres dans [0 ; 1[ à partir d'une graine entière non signée.
 *
 * @param graine Entier de graine (32 bits, converti via `>>> 0`).
 */
export interface TirageMulberry32 {
  readonly etat: number;
  readonly valeur: number;
}

export function tirerMulberry32(etat: number): TirageMulberry32 {
  const prochainEtat = (etat + 0x6d2b79f5) >>> 0;
  let t = prochainEtat;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    etat: prochainEtat,
    valeur: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
  };
}

export function mulberry32(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    const tirage = tirerMulberry32(etat);
    etat = tirage.etat;
    return tirage.valeur;
  };
}
