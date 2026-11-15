import type { CompteIdentite } from "./types.js";

export const DEPOT_IDENTITE = "DEPOT_IDENTITE";

export interface DepotIdentite {
  creer(compte: CompteIdentite): Promise<boolean>;
  trouverParIdentifiant(identifiantNormalise: string): Promise<CompteIdentite | undefined>;
  trouverParId(utilisateurId: string): Promise<CompteIdentite | undefined>;
  definirLangue(utilisateurId: string, langue: CompteIdentite["langue"]): Promise<boolean>;
}
