/**
 * Capacité de batterie minimale pour tenir l'éclipse (annexe B) :
 *   C = P × T × f_éclipse / (3600 · DoD · η)
 * avec P en W, T en s, f sans dimension, DoD = profondeur de décharge, η = rendement.
 *
 * Référence : capaciteBatterieMin(96 W, 0,35, 7 065,7 s, 0,5, 0,9) = 146,5 Wh (T1-08).
 */
export function capaciteBatterieMin(
  puissanceW: number,
  fractionEclipse: number,
  periodeS: number,
  profondeurDecharge: number,
  rendement: number,
): number {
  return (puissanceW * periodeS * fractionEclipse) / (3600 * profondeurDecharge * rendement);
}
