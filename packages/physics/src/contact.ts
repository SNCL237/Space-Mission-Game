import { LUNE, type CorpsCeleste } from "./corps/lune.js";
import { periode } from "./orbite.js";

/** Résultat de A4 (contact sol), en unités explicites. */
export interface ResultatContactSol {
  /** Angle central visible λ, en degrés. */
  readonly lambdaDeg: number;
  /** Contact maximal sur une orbite, en minutes. */
  readonly dureeMaxMin: number;
  /** Contact moyen (× 0,6, facteur de A4), en minutes. */
  readonly dureeMoyenneMin: number;
}

/**
 * A4 tel qu'écrit (cahier de conception §6.2) :
 *   λ = arccos( (R / (R + h)) · cos ε ) − ε ; contact max = T · 2λ/360 ; moyen = 0,6 × max.
 *
 * HYPOTHESE (Q-01) : A4 suppose une station située **sur le corps central**. Pour la Lune,
 * les stations sont sur Terre : appliqué tel quel, A4 donne ≈ 4,3 min de contact moyen à
 * 50 km alors que LRO réalise ~6 passes d'~1 h par jour. L'écart est consigné dans
 * `docs/QUESTIONS.md` (Q-01) ; la variante « A4-bis » (visibilité Terre-orbiteur) est à valider.
 */
export function contactSol(
  altitudeKm: number,
  epsilonDeg = 10,
  corps: CorpsCeleste = LUNE,
): ResultatContactSol {
  const epsilonRad = (epsilonDeg * Math.PI) / 180;
  const ratio = corps.rayonKm / (corps.rayonKm + altitudeKm);
  const lambdaRad = Math.acos(ratio * Math.cos(epsilonRad)) - epsilonRad;
  const lambdaDeg = (lambdaRad * 180) / Math.PI;
  const dureeMaxMin = (periode(altitudeKm, corps) * ((2 * lambdaDeg) / 360)) / 60;
  return { lambdaDeg, dureeMaxMin, dureeMoyenneMin: 0.6 * dureeMaxMin };
}
