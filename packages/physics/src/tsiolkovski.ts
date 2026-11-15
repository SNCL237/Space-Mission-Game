/** Poids de l'eau (standard), m/s². */
export const G0_MSS = 9.80665;

/**
 * Tsiolkovski (cahier de conception §6.2) : masse de carburant à emporter pour un Δv donné,
 * à partir de la **masse sèche** :
 *   m_carburant = m_sèche × (e^(Δv·(1 + marge) / (Isp · g0)) − 1)
 *
 * Référence annexe B : tsiolkovski(200 kg, 1 000 m/s, Isp 300 s, marge 0) = 80,96 kg.
 */
export function tsiolkovski(
  masseSecheKg: number,
  deltaVms: number,
  ispS: number,
  margeDv = 0,
): number {
  const deltaVEffectif = deltaVms * (1 + margeDv);
  const vEchappement = ispS * G0_MSS;
  return masseSecheKg * (Math.exp(deltaVEffectif / vEchappement) - 1);
}
