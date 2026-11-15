import type { ReferentielCatalogue } from "@smdg/contracts";
import { schemaReferentielCatalogue } from "@smdg/contracts";

import type { DocumentCatalogue } from "./schema-catalogue.js";

// F2.3 : projection du document domaine → contrat C1 (les blocs `gameplay`
// sont aplaties dans les champs plats de C1 ; `reference`, catégories, niveaux
// et autres champs supérieurs restent côté domaine). La projection est
// re-validée par le schéma C1 avant d'être stockée ou servie : CAT prouve
// ainsi qu'il produit un C1 lisible (preuve consommateur, P2).

/** Projection C1 d'un document catalogue. */
export function projeterVersC1(document: DocumentCatalogue): ReferentielCatalogue {
  return {
    version: document.version,
    composants: document.composants.map((composant) => ({
      id: composant.id,
      source: composant.source,
      ...(composant.urlSource !== undefined ? { urlSource: composant.urlSource } : {}),
      categorie: composant.categorie,
      nom: composant.nom,
      niveau: composant.niveau,
      masseKg: composant.gameplay.masseKg,
      powerW: composant.gameplay.powerW,
      dutyCycle: composant.gameplay.dutyCycle,
      ...(composant.gameplay.capaciteBatterieWh !== undefined
        ? { capaciteBatterieWh: composant.gameplay.capaciteBatterieWh }
        : {}),
      ...(composant.gameplay.ispS !== undefined ? { ispS: composant.gameplay.ispS } : {}),
      ...(composant.gameplay.degradationAn !== undefined
        ? { degradationAn: composant.gameplay.degradationAn }
        : {}),
      costMUSD: composant.gameplay.costMUSD,
      fiabilite: composant.gameplay.fiabilite,
    })),
    instruments: document.instruments.map((instrument) => ({
      id: instrument.id,
      source: instrument.source,
      ...(instrument.urlSource !== undefined ? { urlSource: instrument.urlSource } : {}),
      nom: instrument.nom,
      ...(instrument.missionsReelles !== undefined
        ? { missionsReelles: instrument.missionsReelles }
        : {}),
      masseKg: instrument.gameplay.masseKg,
      powerW: instrument.gameplay.powerW,
      dutyCycle: instrument.gameplay.dutyCycle,
      ...(instrument.incompatiblesAvec !== undefined
        ? { incompatiblesAvec: instrument.incompatiblesAvec }
        : {}),
      costMUSD: instrument.gameplay.costMUSD,
      dataMbps: instrument.gameplay.dataMbps,
      valeurScientifique: instrument.gameplay.valeurScientifique,
      fiabilite: instrument.gameplay.fiabilite,
    })),
    orbites: document.orbites.map((orbite) => ({
      id: orbite.id,
      source: orbite.source,
      ...(orbite.urlSource !== undefined ? { urlSource: orbite.urlSource } : {}),
      type: orbite.type,
      altitudeKm: orbite.gameplay.altitudeKm,
      inclinaisonDeg: orbite.gameplay.inclinaisonDeg,
      periodeS: orbite.gameplay.periodeS,
      fractionOmbre: orbite.gameplay.fractionOmbre,
      tempsContactSolMin: orbite.gameplay.tempsContactSolMin,
      couverture: orbite.gameplay.couverture,
    })),
    lanceurs: document.lanceurs.map((lanceur) => ({
      id: lanceur.id,
      source: lanceur.source,
      ...(lanceur.urlSource !== undefined ? { urlSource: lanceur.urlSource } : {}),
      nom: lanceur.nom,
      classe: lanceur.classe,
      capaciteKg: lanceur.gameplay.capaciteKg,
      costMUSD: lanceur.gameplay.costMUSD,
      fiabilite: lanceur.gameplay.fiabilite,
    })),
    stationsSol: document.stationsSol.map((station) => ({
      id: station.id,
      source: station.source,
      ...(station.urlSource !== undefined ? { urlSource: station.urlSource } : {}),
      nom: station.nom,
      dataMbps: station.gameplay.dataMbps,
    })),
    seuils: document.seuils,
  };
}

/**
 * Projection + contrôle de conformité C1 : échoue (message nominatif) si la
 * projection ne respecte pas le contrat gelé — garde-fou interne, jamais
 * censé arriver sur un document qui a passé `schemaCatalogue`.
 */
export function projeterVersC1Valide(document: DocumentCatalogue): ReferentielCatalogue {
  const projection = projeterVersC1(document);
  const resultat = schemaReferentielCatalogue.safeParse(projection);
  if (!resultat.success) {
    const champs = resultat.error.issues.map((issue) => issue.path.join(".")).join("; ");
    throw new Error(`PROJECTION_C1_INVALIDE — ${champs}`);
  }
  return resultat.data;
}
