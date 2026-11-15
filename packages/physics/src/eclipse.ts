import { LUNE, type CorpsCeleste } from "./corps/lune.js";
import { demiGrandAxe, periode } from "./orbite.js";

/**
 * Fraction d'éclipse **géométrique maximale** (soleil dans le plan orbital) :
 * f = asin(R / a) / π — annexe B (0,4245 à 50 km, 0,3945 à 100 km, 0,3541 à 200 km).
 */
export function fractionEclipseMax(altitudeKm: number, corps: CorpsCeleste = LUNE): number {
  return Math.asin(corps.rayonKm / demiGrandAxe(altitudeKm, corps)) / Math.PI;
}

/** Durée d'éclipse maximale, en minutes (fraction × période). */
export function dureeEclipseMaxMin(altitudeKm: number, corps: CorpsCeleste = LUNE): number {
  return (fractionEclipseMax(altitudeKm, corps) * periode(altitudeKm, corps)) / 60;
}
