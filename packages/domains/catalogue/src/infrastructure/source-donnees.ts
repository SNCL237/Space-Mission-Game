import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Chargement JSON depuis le disque (F2.2, T2-01) : le catalogue est découpé
// en fragments `data/*.json` (meta + sections) fusionnés en un seul document.
// La racine se résout en remontant depuis `process.cwd()` jusqu'au
// `pnpm-workspace.yaml` — fonctionne depuis la racine, un paquet ou un
// sous-dossier de test, sans dépendre du dossier courant exact.
// Surcharge : `SMDG_CATALOGUE_DATA_DIR` (tests isolés), `SMDG_WORKSPACE_ROOT`.

/** Racine du workspace (dossier contenant `pnpm-workspace.yaml`). */
export function resoudreRacineWorkspace(): string {
  const surcharge = process.env.SMDG_WORKSPACE_ROOT;
  if (surcharge !== undefined && surcharge !== "") return resolve(surcharge);
  let dossier = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dossier, "pnpm-workspace.yaml"))) return dossier;
    const parent = dirname(dossier);
    if (parent === dossier) {
      throw new Error(
        `WORKSPACE_INTROUVE — pnpm-workspace.yaml introuvable en remontant depuis ${process.cwd()}`,
      );
    }
    dossier = parent;
  }
}

/** Dossier `data/` du catalogue (surchargeable par `SMDG_CATALOGUE_DATA_DIR`). */
export function resoudreDossierCatalogue(): string {
  const surcharge = process.env.SMDG_CATALOGUE_DATA_DIR;
  if (surcharge !== undefined && surcharge !== "") return resolve(surcharge);
  return join(resoudreRacineWorkspace(), "packages", "domains", "catalogue", "data");
}

/**
 * Fusionne tous les fragments JSON du dossier en un document unique —
 * une clé présente dans deux fragments lève `FRAGMENT_DUPLIQUE` (jamais de
 * fusion silencieuse).
 */
export function chargerCatalogueDepuisDisque(): unknown {
  const dossier = resoudreDossierCatalogue();
  const fichiers = readdirSync(dossier)
    .filter((nom) => nom.endsWith(".json"))
    .sort();
  if (fichiers.length === 0) {
    throw new Error(`CATALOGUE_VIDE — aucun fichier JSON dans ${dossier}`);
  }
  const document: Record<string, unknown> = {};
  for (const fichier of fichiers) {
    const contenu = JSON.parse(readFileSync(join(dossier, fichier), "utf8")) as Record<
      string,
      unknown
    >;
    for (const [cle, valeur] of Object.entries(contenu)) {
      if (cle in document) {
        throw new Error(
          `FRAGMENT_DUPLIQUE — clé « ${cle} » présente dans ${fichier} et un autre fragment`,
        );
      }
      document[cle] = valeur;
    }
  }
  return document;
}
