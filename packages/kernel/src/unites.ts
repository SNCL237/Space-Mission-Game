// Scalaires étiquetés par unité (Agent.md §9 : « Unités dans les noms :
// massKg, powerW, dataMbps, energyWh, costMUSD, altitudeKm »).
// HYPOTHESE (Q-15) : la documentation impose les noms d'unités mais pas le mécanisme ;
// on retient un marqueur de type nominal léger (brand) + fabriques/comparateurs.

/** Marque de type interne : identifie l'unité d'un nombre étiqueté. */
declare const marqueUnite: unique symbol;

/** Nombre étiqueté par l'unité `U` (invisible à l'exécution). */
export type Unite<U extends string> = number & { readonly [marqueUnite]: U };

/** Masse en kilogrammes. */
export type massKg = Unite<"massKg">;
/** Puissance en watts. */
export type powerW = Unite<"powerW">;
/** Débit de données en Mbit/s. */
export type dataMbps = Unite<"dataMbps">;
/** Énergie en wattheures. */
export type energyWh = Unite<"energyWh">;
/** Coût en millions de dollars US. */
export type costMUSD = Unite<"costMUSD">;
/** Altitude en kilomètres. */
export type altitudeKm = Unite<"altitudeKm">;

/** Étiquette une valeur comme masse (kg). */
export const massKg = (valeur: number): massKg => valeur as massKg;
/** Étiquette une valeur comme puissance (W). */
export const powerW = (valeur: number): powerW => valeur as powerW;
/** Étiquette une valeur comme débit (Mbit/s). */
export const dataMbps = (valeur: number): dataMbps => valeur as dataMbps;
/** Étiquette une valeur comme énergie (Wh). */
export const energyWh = (valeur: number): energyWh => valeur as energyWh;
/** Étiquette une valeur comme coût (M$). */
export const costMUSD = (valeur: number): costMUSD => valeur as costMUSD;
/** Étiquette une valeur comme altitude (km). */
export const altitudeKm = (valeur: number): altitudeKm => valeur as altitudeKm;

/** Somme de deux grandeurs de même unité. */
export function ajouter<U extends string>(a: Unite<U>, b: Unite<U>): Unite<U> {
  return (a + b) as Unite<U>;
}

/** Comparaison ordonnée de deux grandeurs de même unité (-1, 0 ou 1). */
export function comparer<U extends string>(a: Unite<U>, b: Unite<U>): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Plus petite de deux grandeurs de même unité. */
export function minimum<U extends string>(a: Unite<U>, b: Unite<U>): Unite<U> {
  return a <= b ? a : b;
}
