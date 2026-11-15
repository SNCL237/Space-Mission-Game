import { LUNE, type CorpsCeleste } from "./corps/lune.js";

// Orbites circulaires autour de `corps` (hypothèse képlérienne autorisée en P7, Q-11).

/** Demi-grand axe a = R + h, en km. */
export function demiGrandAxe(altitudeKm: number, corps: CorpsCeleste = LUNE): number {
  return corps.rayonKm + altitudeKm;
}

/** Période orbitale T = 2π√(a³/μ), en secondes. */
export function periode(altitudeKm: number, corps: CorpsCeleste = LUNE): number {
  const a = demiGrandAxe(altitudeKm, corps);
  return 2 * Math.PI * Math.sqrt(a ** 3 / corps.muKm3s2);
}

/** Vitesse circulaire v = √(μ/a), en km/s. */
export function vitesseCirculaire(altitudeKm: number, corps: CorpsCeleste = LUNE): number {
  return Math.sqrt(corps.muKm3s2 / demiGrandAxe(altitudeKm, corps));
}

export interface PositionOrbiteKm {
  readonly xKm: number;
  readonly yKm: number;
  readonly zKm: number;
}

export interface PointOrbite {
  readonly tempsS: number;
  readonly positionKm: PositionOrbiteKm;
}

/** Position inertielle d'une orbite circulaire képlérienne autour du corps central. */
export function positionOrbiteCirculaire(
  altitudeKm: number,
  inclinaisonDeg: number,
  tempsS: number,
  corps: CorpsCeleste = LUNE,
): PositionOrbiteKm {
  if (
    !Number.isFinite(altitudeKm) ||
    altitudeKm <= 0 ||
    !Number.isFinite(inclinaisonDeg) ||
    inclinaisonDeg < 0 ||
    inclinaisonDeg > 180 ||
    !Number.isFinite(tempsS)
  ) {
    throw new RangeError("PARAMETRES_ORBITE_INVALIDES");
  }
  const rayon = demiGrandAxe(altitudeKm, corps);
  const angle = (2 * Math.PI * tempsS) / periode(altitudeKm, corps);
  const inclinaison = (inclinaisonDeg * Math.PI) / 180;
  return {
    xKm: rayon * Math.cos(angle),
    yKm: rayon * Math.sin(angle) * Math.cos(inclinaison),
    zKm: rayon * Math.sin(angle) * Math.sin(inclinaison),
  };
}

export function echantillonnerOrbiteCirculaire(
  altitudeKm: number,
  inclinaisonDeg: number,
  nombrePoints = 720,
  corps: CorpsCeleste = LUNE,
): readonly PointOrbite[] {
  if (!Number.isInteger(nombrePoints) || nombrePoints < 2 || nombrePoints > 10_000) {
    throw new RangeError("NOMBRE_ECHANTILLONS_INVALIDE");
  }
  const duree = periode(altitudeKm, corps);
  return Array.from({ length: nombrePoints }, (_, index) => {
    const tempsS = (duree * index) / nombrePoints;
    return {
      tempsS,
      positionKm: positionOrbiteCirculaire(altitudeKm, inclinaisonDeg, tempsS, corps),
    };
  });
}
