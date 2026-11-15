// Identifiants du domaine : UUID v4 (Agent.md §6.1 : `type Id = string; // UUID`).
// HYPOTHESE (Q-15) : la documentation ne précise pas si `Id` est une marque de type ;
// on retient une marque de type (sous-ensemble de `string`) + garde/fabrique, pour que
// seuls les UUID v4 valides circulent en typed entre les domaines.

/** Marque de type : un `Id` est un `string` réservé aux UUID v4. */
declare const marqueId: unique symbol;

/** Identifiant opaque de domaine (UUID v4). */
export type Id = string & { readonly [marqueId]: "Id" };

/** Format UUID v4 (RFC 4122, version 4, variant 8-b/9-b/a-b/c-f). */
export const REGEX_ID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fabrique d'identifiant : UUID v4 tiré du générateur cryptographique de Node. */
export function nouvelId(): Id {
  return crypto.randomUUID() as Id;
}

/** Garde de type : true si la valeur est un UUID v4 valide. */
export function estId(valeur: unknown): valeur is Id {
  return typeof valeur === "string" && REGEX_ID_V4.test(valeur);
}

/** Conversion contrôlée : lève une erreur si la valeur n'est pas un UUID v4. */
export function versId(valeur: string): Id {
  if (!REGEX_ID_V4.test(valeur)) {
    throw new Error(`Identifiant UUID v4 attendu, reçu : ${valeur}`);
  }
  return valeur as Id;
}
