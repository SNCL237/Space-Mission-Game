import type { Source } from "../source.js";

// Constantes de la Lune — valeurs de référence (annexe B du PLAN, calculées avec
// μ = 4 902,8 km³/s² et R = 1 737,1 km ; à relire dans GMAT, Q-05).

/** Corps céleste : rayon et paramètre de gravitation standard. */
export interface CorpsCeleste {
  readonly nom: string;
  readonly rayonKm: number;
  readonly muKm3s2: number;
}

/** Constante de gravitation newtonienne G (CODATA 2018), m³·kg⁻¹·s⁻². */
export const G_SI: Source<number> = {
  valeur: 6.6743e-11,
  source: "CODATA 2018 (NIST)",
  urlSource: "https://physics.nist.gov/cgi-bin/cuu/Value?G",
};

/** Masse de la Lune, kg — fiche NSSDC. */
export const MASSE_LUNE: Source<number> = {
  valeur: 0.07346e24,
  source: "NSSDC Moon Fact Sheet",
  urlSource: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
};

/**
 * μ = G × M calculé à partir des deux sources ci-dessus, en km³/s².
 * C'est la valeur comparée à μ du cahier dans T1-04 (écart attendu ≈ 0,003 %).
 */
export function muDepuisGxM(): number {
  return (G_SI.valeur * MASSE_LUNE.valeur) / 1e9;
}

/** Lune (cible du MVP). */
export const LUNE: CorpsCeleste = {
  nom: "Lune",
  /** Cahier de conception, annexe B (à relire dans GMAT, Q-05). */
  rayonKm: 1737.1,
  /** NSSDC Moon Fact Sheet : GM = 4 902,8 km³/s². */
  muKm3s2: 4902.8,
};
