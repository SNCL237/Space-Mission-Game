import type { ConfigurationFigee, ProfilOperations, ReferentielCatalogue } from "@smdg/contracts";

// B2 (audit front↔back) : le profil d'opérations est CALCULÉ PAR LE SERVEUR à partir de la
// configuration figée et du catalogue. Le client ne peut plus fixer la fiabilité, le temps
// de contact ou les facteurs de crise. Valeurs de scénario : source « a-calibrer ».

const G0 = 9.80665;
const JOURS_MISSION = 30;

/** HYPOTHÈSE (Q-01, à calibrer) : ≈ 6 passages d'1 h par jour via le réseau sol, ordre de
 *  grandeur des opérations LRO, au lieu des 4,5 min/orbite du modèle A4 (station sur la Lune). */
const CONTACT_S_PAR_JOUR = 6 * 3600;
const OBSERVATION_S_PAR_JOUR = 4 * 3600;
const STOCKAGE_GBIT = 400;

/** MTBF équivalent à une fiabilité R sur la durée de mission : R = exp(−D / MTBF). */
export function mtbfDepuisFiabilite(fiabilite: number, dureeJours = JOURS_MISSION): number {
  const r = Math.min(Math.max(fiabilite, 1e-6), 0.999999);
  return -dureeJours / Math.log(r);
}

export function profilOperationsServeur(
  configuration: ConfigurationFigee,
  catalogue: ReferentielCatalogue,
): ProfilOperations {
  const { orbiteur } = configuration;
  const idsPropulsion = new Set(catalogue.composants.filter((c) => c.ispS !== undefined).map((c) => c.id));
  const propulsion = catalogue.composants.find((c) =>
    orbiteur.elements.some((e) => e.idCatalogue === c.id && idsPropulsion.has(c.id)),
  );
  const ispS = propulsion?.ispS ?? 220;
  const masseSeche = Math.max(1, orbiteur.masseSecheKg);
  const deltaV = ispS * G0 * Math.log((masseSeche + Math.max(0, orbiteur.carburantKg)) / masseSeche);
  const panneau = catalogue.composants.find((c) =>
    orbiteur.elements.some((e) => e.idCatalogue === c.id && c.degradationAn !== undefined),
  );
  const degradationAn = panneau?.degradationAn ?? 0.02;
  const mtbf: Record<string, number> = {};
  for (const e of orbiteur.elements) mtbf[e.idCatalogue] = mtbfDepuisFiabilite(e.fiabilite);
  for (const i of orbiteur.instruments) mtbf[i.idCatalogue] = mtbfDepuisFiabilite(i.fiabilite);
  const debit = Math.max(1, ...catalogue.stationsSol.map((s) => s.dataMbps));
  return {
    source: "serveur:a-calibrer",
    dureeCibleJours: JOURS_MISSION,
    batterieInitialeWh: orbiteur.capaciteBatterieWh,
    capaciteStockageGbit: STOCKAGE_GBIT,
    debitLiaisonMbps: debit,
    tempsContactSParJour: CONTACT_S_PAR_JOUR,
    tempsObservationSParJour: OBSERVATION_S_PAR_JOUR,
    reserveDeltaVms: Math.max(0, deltaV),
    ispS,
    seuilBatterieDegrade: 0.5,
    seuilBatterieCritique: 0.2,
    mtbfJoursParSysteme: mtbf,
    limitesVieJours: {
      // Perte de 20 % de puissance des panneaux.
      degradationPanneaux: Math.max(1, (0.2 / Math.max(degradationAn, 1e-4)) * 365),
      autonomieCarburant: 3 * 365,
      toleranceRadiation: 3 * 365,
    },
    // GDD Acte V : perte d'une chaîne de cellules au jour 5 (−35 % de production).
    anomalieScenarisee: { jour: 5, facteurProduction: 0.65 },
    crise: {
      delaiDecisionJours: 2,
      facteurTransmission: 0.5,
      dureeSuspensionObservationsJours: 3,
      facteurBasseConsommation: 0.5,
      penaliteRisqueAccru: 0.1,
    },
  };
}
