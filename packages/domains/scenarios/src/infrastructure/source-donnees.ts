import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Chargement JSON depuis le disque (F2.10, T2-15) : chaque scénario vit dans
// `data/<dossier>/paquet.json` — ajouter un scénario = ajouter un dossier JSON,
// **zéro changement de code** (Agent.md §6). La racine se résout en remontant
// depuis `process.cwd()` jusqu'au `pnpm-workspace.yaml` (le partage de ce
// petit utilitaire avec le domaine catalogue est interdit par RI1 : on le
// duplique ici). Surcharge : `SMDG_SCENARIOS_DATA_DIR`, `SMDG_WORKSPACE_ROOT`.

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

/** Dossier des scénarios (surchargeable par `SMDG_SCENARIOS_DATA_DIR`). */
export function resoudreDossierScenarios(): string {
  const surcharge = process.env.SMDG_SCENARIOS_DATA_DIR;
  if (surcharge !== undefined && surcharge !== "") return resolve(surcharge);
  return join(resoudreRacineWorkspace(), "packages", "domains", "scenarios", "data");
}

/**
 * Découvre tous les paquets du disque : un sous-dossier par scénario,
 * `paquet.json` obligatoire. Trié par nom de dossier (déterministe).
 * Aucun paquet ⇒ `SCENARIO_VIDE`.
 */
export function chargerPaquetsDepuisDisque(): { fichier: string; brut: unknown }[] {
  const dossier = resoudreDossierScenarios();
  const sousDossiers = readdirSync(dossier)
    .filter((nom) => statSync(join(dossier, nom)).isDirectory())
    .sort();
  const paquets: { fichier: string; brut: unknown }[] = [];
  for (const sousDossier of sousDossiers) {
    const chemin = join(dossier, sousDossier, "paquet.json");
    if (!existsSync(chemin)) continue;
    paquets.push({
      fichier: `${sousDossier}/paquet.json`,
      brut: JSON.parse(readFileSync(chemin, "utf8")) as unknown,
    });
  }
  if (paquets.length === 0) {
    throw new Error(`SCENARIO_VIDE — aucun data/<scenario>/paquet.json dans ${dossier}`);
  }
  return paquets;
}
