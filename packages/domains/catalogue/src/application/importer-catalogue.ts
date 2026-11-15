import { Inject, Injectable } from "@nestjs/common";
import type { CodeExplication } from "@smdg/contracts";
import { schemaReferentielCatalogue } from "@smdg/contracts";
import type { ZodError } from "zod";

import { DEPOT_CATALOGUE, type DepotCatalogue } from "../domain/depot.js";
import { projeterVersC1 } from "../domain/projection.js";
import {
  construireSchemaCatalogue,
  type OptionsSchemaCatalogue,
} from "../domain/schema-catalogue.js";

// F2.2 : import du catalogue — validation Zod (blocs `gameplay`/`reference`,
// RG12), projection C1 re-validée, persistance idempotente par version.
// Le rapport est un tableau de `CodeExplication` (C7) : codes seuls, jamais
// de texte joueur (RI7) — le message FR sert de paramètre de diagnostic.

/** Rapport d'import : refusé ⇒ rien n'est stocké (T2-01 : un défaut = échec). */
export interface RapportImportCatalogue {
  readonly importe: boolean;
  readonly version?: string;
  readonly erreurs: CodeExplication[];
}

/** Mapping issue Zod → code C7 : problème de source ⇒ `CATALOGUE_SOURCE_INVALIDE`. */
export function versErreursCatalogue(erreur: ZodError): CodeExplication[] {
  const vus = new Set<string>();
  const erreurs: CodeExplication[] = [];
  for (const issue of erreur.issues) {
    const chemin = issue.path.map(String);
    const estSource = chemin.some((segment) =>
      ["source", "urlSource", "missionsReelles"].includes(segment),
    );
    const code = estSource ? "CATALOGUE_SOURCE_INVALIDE" : "CATALOGUE_SCHEMA_INVALIDE";
    const champs = chemin.join(".") || "(racine)";
    const cle = `${code}|${champs}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    erreurs.push({ version: 1, code, params: { champs, message: issue.message } });
  }
  return erreurs;
}

@Injectable()
export class ImporterCatalogue {
  constructor(@Inject(DEPOT_CATALOGUE) private readonly depot: DepotCatalogue) {}

  /**
   * Valide `brut` contre le schéma domaine (RG12 inclus), projette en C1 et
   * enregistre — ou retourne le rapport d'erreurs sans rien stocker.
   * `options.domainesAcceptes` rend la liste des domaines configurable (T2-02).
   */
  async importer(
    brut: unknown,
    options: OptionsSchemaCatalogue = {},
  ): Promise<RapportImportCatalogue> {
    const schema = construireSchemaCatalogue(options);
    const parse = schema.safeParse(brut);
    if (!parse.success) {
      return { importe: false, erreurs: versErreursCatalogue(parse.error) };
    }
    // Le document domaine doit projecter en un C1 valide (contrat gelé) :
    if (!schemaReferentielCatalogue.safeParse(projeterVersC1(parse.data)).success) {
      return {
        importe: false,
        erreurs: [
          { version: 1, code: "CATALOGUE_SCHEMA_INVALIDE", params: { champs: "projection-c1" } },
        ],
      };
    }
    await this.depot.enregistrer(parse.data);
    return { importe: true, version: parse.data.version, erreurs: [] };
  }
}
