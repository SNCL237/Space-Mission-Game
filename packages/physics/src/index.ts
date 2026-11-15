// Formules physiques purs (P1) — valeurs de référence annexe B, zéro import NestJS (RI3).

export { G_SI, LUNE, MASSE_LUNE, muDepuisGxM, type CorpsCeleste } from "./corps/lune.js";
export {
  demiGrandAxe,
  echantillonnerOrbiteCirculaire,
  periode,
  positionOrbiteCirculaire,
  vitesseCirculaire,
  type PointOrbite,
  type PositionOrbiteKm,
} from "./orbite.js";
export { dureeEclipseMaxMin, fractionEclipseMax } from "./eclipse.js";
export { contactSol, type ResultatContactSol } from "./contact.js";
export { G0_MSS, tsiolkovski } from "./tsiolkovski.js";
export { capaciteBatterieMin } from "./batterie.js";
export type { Source } from "./source.js";
