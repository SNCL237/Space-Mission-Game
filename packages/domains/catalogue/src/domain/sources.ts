// RG12 / BF36 : toute valeur réelle porte `source` + `urlSource` (https) ;
// sinon la valeur est balisée « a-calibrer » (Agent.md §0.2). La liste des
// domaines de référence acceptés est **configurable** (T2-02).

/** Balise d'une valeur encore à calibrer — aucune URL attendue. */
export const SOURCE_A_CALIBRER = "a-calibrer";

/**
 * Domaines de référence acceptés par défaut (suffixe de l'hôte, sous-domaines
 * inclus) — `nasa.gov` couvre `science.nasa.gov`, `ntrs.nasa.gov`, … ;
 * `usgs.gov` pour l'astrogéologie. Surcharge possible via
 * `construireSchemaCatalogue({ domainesAcceptes })` (T2-02).
 */
export const DOMAINES_ACCEPTES_DEFAUT: readonly string[] = ["nasa.gov", "usgs.gov"];

/** Règles de source actives pour une validation de document. */
export interface ReglesSource {
  readonly domainesAcceptes: readonly string[];
}

/** Une source est « réelle » dès qu'elle n'est plus balisée `a-calibrer`. */
export function estSourceReelle(source: string): boolean {
  return source !== SOURCE_A_CALIBRER;
}

/**
 * Contrôle RG12 d'une paire `source`/`urlSource` : retourne un message
 * d'erreur FR si la paire est invalide, sinon `undefined`.
 * - source réelle ⇒ `urlSource` obligatoire, en https, domaine accepté ;
 * - source `a-calibrer` ⇒ aucune URL obligatoire, mais une URL fournie reste
 *   contrôlée (https + domaine accepté).
 */
export function problemeSource(
  source: string,
  urlSource: string | undefined,
  regles: ReglesSource,
): string | undefined {
  if (estSourceReelle(source) && (urlSource === undefined || urlSource === "")) {
    return `urlSource https obligatoire pour une source réelle (« ${source} » ≠ ${SOURCE_A_CALIBRER})`;
  }
  if (urlSource === undefined) return undefined;
  if (!urlSource.startsWith("https://")) {
    return `urlSource doit être en https (reçu : ${urlSource})`;
  }
  let hote: string;
  try {
    hote = new URL(urlSource).hostname;
  } catch {
    return `urlSource illisible (reçu : ${urlSource})`;
  }
  const accepte = regles.domainesAcceptes.some(
    (domaine) => hote === domaine || hote.endsWith(`.${domaine}`),
  );
  if (!accepte) {
    return `domaine de source non accepté : ${hote} (autorisés : ${regles.domainesAcceptes.join(", ")})`;
  }
  return undefined;
}
