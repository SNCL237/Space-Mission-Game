import { CODES_SCENARIO, type CodeExplication } from "@smdg/contracts";
import type { ZodIssue } from "zod";

import type { SituationScenario } from "./depot.js";
import { schemaPaquetScenarioSc } from "./schema-paquet.js";

// A11 (cahier de conception §6.2, F2.9) : validation d'un import de paquet —
// schéma + version, 7 actes, 4 fins atteignables, identifiants du catalogue
// autorisés existants dans CAT, conditions sans cycle ; la liste **complète**
// des erreurs est retournée en une seule fois (T2-10) et la publication est
// refusée si elle n'est pas vide.

/** Contexte d'A11 : ce que CAT et le dépôt SCE savent au moment de valider. */
export interface ContexteA11 {
  readonly identifiantsCatalogue: readonly string[];
  readonly scenariosConnus: readonly SituationScenario[];
}

/** Codes A11 (C7 : codes seuls, jamais de texte joueur — RI7). */
export const CODES_A11 = {
  ...CODES_SCENARIO,
} as const;

/** Champs porteurs d'un texte bilingue (T2-11 : clés `fr` ET `en`). */
const CHAMPS_TEXTUELS = new Set([
  "titre",
  "description",
  "conclusion",
  "texte",
  "nom",
  "role",
  "motivation",
]);

/** Mapping issue Zod → code A11 (un défaut = un code identifiable, T2-10). */
function codeDeIssue(issue: ZodIssue): string {
  const chemin = issue.path.map(String);
  // Les textes d'abord : un `titre` absent dans un acte est un texte manquant
  // (T2-11), pas un problème du nombre d'actes (T2-10).
  if (chemin.some((segment) => segment === "fr" || segment === "en")) {
    return CODES_A11.TEXTE_MANQUANT;
  }
  if (chemin.some((segment) => CHAMPS_TEXTUELS.has(segment))) {
    return CODES_A11.TEXTE_MANQUANT;
  }
  if (chemin[0] === "actes") return CODES_A11.ACTES_INVALIDE;
  if (chemin[0] === "fins") return CODES_A11.FINS_INVALIDE;
  if (chemin[0] === "conditionsDeblocage") return CODES_A11.CONDITION_INVALIDE;
  if (chemin[0] === "definitionsEvenements" || chemin[0] === "evenementsNarratifs") {
    return CODES_A11.EVENEMENT_INVALIDE;
  }
  return CODES_A11.PAQUET_INVALIDE;
}

/** Table d'un champ racine, défensive (le brut peut être partiellement invalide). */
function table(brut: unknown, cle: string): unknown[] | undefined {
  if (typeof brut !== "object" || brut === null) return undefined;
  const valeur = (brut as Record<string, unknown>)[cle];
  return Array.isArray(valeur) ? valeur : undefined;
}

/**
 * Détecte un cycle parmi les arêtes `prerequis` (DFS, nœud de retour = cycle).
 * Couvre l'auto-référence et les cycles à plusieurs scénarios (T2-10).
 */
export function trouverCycle(aretes: readonly SituationScenario[]): string | undefined {
  const graphe = new Map<string, string[]>();
  for (const arete of aretes) {
    graphe.set(arete.id, [...(graphe.get(arete.id) ?? []), ...arete.prerequis]);
  }
  const enCours = new Set<string>();
  const fait = new Set<string>();
  const visiter = (noeud: string): string | undefined => {
    if (fait.has(noeud)) return undefined;
    if (enCours.has(noeud)) return noeud;
    enCours.add(noeud);
    for (const suivant of graphe.get(noeud) ?? []) {
      const retour = visiter(suivant);
      if (retour !== undefined) return retour;
    }
    enCours.delete(noeud);
    fait.add(noeud);
    return undefined;
  };
  for (const noeud of graphe.keys()) {
    const cycle = visiter(noeud);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

/**
 * A11 complet : toutes les erreurs d'un paquet, en une seule passe — les
 * contrôles Zod (schéma) et les contrôles sémantiques (7/4, atteignabilité,
 * catalogue, cycles, RG6) sont **cumulés**, jamais courts-circuités.
 */
export function validerPaquetA11(brut: unknown, contexte: ContexteA11): CodeExplication[] {
  const erreurs: CodeExplication[] = [];
  const vus = new Set<string>();
  const ajouter = (code: string, champs: string, params: Record<string, string | number>): void => {
    const cle = `${code}|${champs}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    erreurs.push({ version: 1, code, params: { ...params, champs } });
  };

  // 1. Schéma (C2 étendu) — chaque issue mappée sur son code A11.
  const parse = schemaPaquetScenarioSc.safeParse(brut);
  if (!parse.success) {
    for (const issue of parse.error.issues) {
      const champs = issue.path.map(String).join(".") || "(racine)";
      ajouter(codeDeIssue(issue), champs, { message: issue.message });
    }
  }

  // 2. Fins atteignables : au moins une règle par fin (HYPOTHESE Q-13 —
  //    « atteignable » = une fin sans règle ne peut jamais être produite).
  table(brut, "fins")?.forEach((fin, index) => {
    if (typeof fin !== "object" || fin === null) return;
    const candidate = fin as Record<string, unknown>;
    const regles = candidate["regles"];
    if (!Array.isArray(regles) || regles.length === 0) {
      ajouter(CODES_A11.FIN_INATTEIGNABLE, `fins[${index}]`, {
        fin: typeof candidate["code"] === "string" ? candidate["code"] : index,
      });
    }
  });

  // 3. Chaque identifiant du catalogueAutorise existe dans CAT (A11).
  table(brut, "catalogueAutorise")?.forEach((identifiant, index) => {
    if (typeof identifiant !== "string") return;
    if (!contexte.identifiantsCatalogue.includes(identifiant)) {
      ajouter(CODES_A11.CATALOGUE_INCONNU, `catalogueAutorise[${index}]`, {
        catalogue: identifiant,
      });
    }
  });

  // 4. Conditions : scénarios référencés existants + absence de cycle (A11).
  const idPaquet =
    typeof brut === "object" && brut !== null && typeof (brut as { id?: unknown }).id === "string"
      ? (brut as { id: string }).id
      : undefined;
  const prerequisLocaux: string[] = [];
  table(brut, "conditionsDeblocage")?.forEach((condition, index) => {
    if (typeof condition !== "object" || condition === null) return;
    const candidate = condition as Record<string, unknown>;
    if (candidate["type"] === "prerequis" && typeof candidate["scenarioPrerequis"] === "string") {
      prerequisLocaux.push(candidate["scenarioPrerequis"]);
      const connus = new Set([
        ...contexte.scenariosConnus.map((scenario) => scenario.id),
        ...(idPaquet === undefined ? [] : [idPaquet]),
      ]);
      if (!connus.has(candidate["scenarioPrerequis"])) {
        ajouter(CODES_A11.SCENARIO_INCONNU, `conditionsDeblocage[${index}]`, {
          scenario: candidate["scenarioPrerequis"],
        });
      }
    }
  });
  const aretes: SituationScenario[] = [...contexte.scenariosConnus];
  if (idPaquet !== undefined) {
    aretes.push({ id: idPaquet, prerequis: prerequisLocaux });
  }
  const cycle = trouverCycle(aretes);
  if (cycle !== undefined) {
    ajouter(CODES_A11.CYCLE_DEBLOCAGE, "conditionsDeblocage", { scenario: cycle });
  }

  // 5. RG6 (T2-12) : une définition `critique` doit déclarer un indice.
  table(brut, "definitionsEvenements")?.forEach((definition, index) => {
    if (typeof definition !== "object" || definition === null) return;
    const candidate = definition as Record<string, unknown>;
    if (candidate["critique"] !== true) return;
    const indice = candidate["indice"];
    if (typeof indice !== "string" || indice.trim() === "") {
      ajouter(CODES_A11.EVENEMENT_SANS_INDICE, `definitionsEvenements[${index}]`, {
        evenement: typeof candidate["id"] === "string" ? candidate["id"] : index,
      });
    }
  });

  return erreurs;
}
