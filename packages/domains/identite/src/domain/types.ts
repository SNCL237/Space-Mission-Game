import type { Langue } from "@smdg/contracts";

export interface CompteIdentite {
  readonly id: string;
  readonly pseudo: string;
  readonly identifiantNormalise: string;
  readonly courriel?: string;
  readonly courrielNormalise?: string;
  readonly motDePasseHash: string | null;
  readonly langue: Langue;
  readonly invite: boolean;
}
