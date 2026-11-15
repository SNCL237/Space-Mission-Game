import { CODES_CAMPAGNE, schemaVueMission, type VueMission } from "@smdg/contracts";
import { echantillonnerOrbiteCirculaire, LUNE, periode } from "@smdg/physics";
import { ErreurCampagne, type EntreeJournal, type MissionCampagne } from "@smdg/campagne";

function segmentPour(acte: EntreeJournal["acte"]): VueMission["chronologie"][number]["segment"] {
  if (acte <= 2) return "lancement";
  if (acte <= 4) return "spatial";
  return acte === 5 ? "sol" : "utilisateurs";
}

export function creerVueMission(
  mission: MissionCampagne,
  journal: readonly EntreeJournal[],
  nombrePoints = 720,
): VueMission {
  const configuration = mission.configuration;
  if (configuration === null) {
    throw new ErreurCampagne(
      { version: 1, code: CODES_CAMPAGNE.MISSION_NON_PRETE, params: {} },
      409,
    );
  }
  const altitudeKm = configuration.orbite.altitudeKm;
  const inclinaisonDeg = configuration.orbite.inclinaisonDeg;
  return schemaVueMission.parse({
    version: 1,
    concept: {
      missionId: mission.id,
      scenarioId: mission.scenarioId,
      cible: mission.scenario.cible,
      objectifs: mission.scenario.objectifs.map(({ id, titre, role }) => ({ id, titre, role })),
    },
    trajectoires: {
      referentiel: "lune-centre-inertiel",
      orbite: {
        altitudeKm,
        inclinaisonDeg,
        periodeS: periode(altitudeKm),
      },
      positions: echantillonnerOrbiteCirculaire(
        altitudeKm,
        inclinaisonDeg,
        nombrePoints,
      ),
    },
    chronologie: journal.map((entree) => ({
      id: entree.id,
      date: entree.date,
      acte: entree.acte,
      segment: segmentPour(entree.acte),
      code: entree.libelle,
    })),
    scene3d: {
      corpsCeleste: { nom: LUNE.nom, rayonKm: LUNE.rayonKm },
      engin: { id: configuration.configurationId, trajectoireId: `${mission.id}-orbite` },
    },
    notesModele: [
      "Modèle simplifié : propagation képlérienne à deux corps autour de la Lune.",
      "La vue ne représente ni attitude détaillée ni télémétrie réelle.",
    ],
  });
}
