// Jetons d'injection des ports (Agent.md §3.3, cahier de conception §4.2.3).
// Ce sont des `symbol` uniques : compatibles avec l'argument de `@Inject(JETON)`
// de NestJS, sans importer de paquet NestJS dans ce pur (frontière RI3).

import type { ReferentielCatalogue } from "./c1-catalogue.js";
import type { RoleApi } from "./api.js";
import type { Langue } from "./commun.js";
import type {
  ChoixCrise,
  CommandeSimulation,
  OptionsDemarrageSimulation,
  ProgressionSimulation,
  ResultatSimulation,
} from "./c4-simulation.js";
import type { BilanMission, RapportMission } from "./c5-bilan.js";
import type { PaquetScenario } from "./c2-scenario.js";
import type { ConfigurationFigee } from "./c3-configuration.js";
import type { IdentiteUtilisateur } from "./c8-identite.js";

/**
 * Port de lecture du domaine catalogue (C1), ajouté en P2 (F2.3) : lecture
 * par version et listage des identifiants de documents (contrôle A11
 * `PAQUET_CATALOGUE_INCONNU` côté SCE). Écriture (import) via le dépôt du
 * domaine producteur, pas par ce port consommateur.
 */
export interface PortCatalogue {
  /** Versions de catalogue importées, triées. */
  listerVersions(): Promise<string[]>;
  /** Référentiel C1 d'une version ; `undefined` si la version est inconnue. */
  lire(version: string): Promise<ReferentielCatalogue | undefined>;
  /** Identifiants (UUID) des documents catalogue importés (A11, `catalogueAutorise`). */
  listerIdentifiants(): Promise<string[]>;
}

export interface PortScenarios {
  lister(): Promise<readonly { id: string; version: string; ordre: number }[]>;
  lire(scenarioId: string, version: string): Promise<PaquetScenario | undefined>;
}

export interface PortConception {
  valider(configurationId: string): Promise<void>;
  figer(configurationId: string): Promise<ConfigurationFigee>;
}

export interface PortSimulation {
  demarrer(options: OptionsDemarrageSimulation): string;
  avancer(etatSerialise: string, commandes: readonly CommandeSimulation[], jours: number): string;
  decider(etatSerialise: string, choix: ChoixCrise, cibleId?: string): string;
  terminer(etatSerialise: string): ResultatSimulation;
  progression(etatSerialise: string): ProgressionSimulation;
}

export interface EntreeEvaluation {
  readonly missionId: string;
  readonly mode: "solo" | "equipe";
  readonly scenario: PaquetScenario;
  readonly configuration: ConfigurationFigee;
  readonly resultat: ResultatSimulation;
  readonly collaboration?: {
    readonly tauxParticipation: number;
    readonly conflits: number;
  };
}

export interface PortEvaluation {
  evaluer(entree: EntreeEvaluation): BilanMission;
  genererRapport(entree: EntreeEvaluation, bilan?: BilanMission): RapportMission;
  exporterRapportJson(rapport: RapportMission): string;
}

export interface IdentiteJeton {
  readonly utilisateurId: string;
  readonly role: RoleApi;
}

export interface PortVerificateurJwt {
  verifier(jeton: string): Promise<IdentiteJeton>;
}

export interface PortEmetteurJwt {
  emettre(entree: {
    readonly utilisateurId: string;
    readonly role: RoleApi;
    readonly dureeSecondes: number;
  }): Promise<string>;
}

export interface ProfilIdentite {
  readonly identite: IdentiteUtilisateur;
  readonly pseudo: string;
  readonly courriel?: string;
  readonly invite: boolean;
}

export interface PortIdentite {
  creerInvite(langue: Langue): Promise<{ profil: ProfilIdentite; jeton: string }>;
  inscrire(entree: {
    readonly pseudo: string;
    readonly courriel?: string;
    readonly motDePasse: string;
    readonly langue: Langue;
  }): Promise<{ profil: ProfilIdentite; jeton: string }>;
  connecter(entree: {
    readonly identifiant: string;
    readonly motDePasse: string;
    readonly adresseIp: string;
  }): Promise<{ profil: ProfilIdentite; jeton: string }>;
  lireProfil(utilisateurId: string): Promise<ProfilIdentite>;
  definirLangue(utilisateurId: string, langue: Langue): Promise<ProfilIdentite>;
}

export interface PortPedagogie {
  rendre(code: string, langue: Langue): { titre: string; explication: string; piste: string };
}

/** Port du domaine catalogue (C1, lecture seule). */
export const CATALOGUE_PORT: unique symbol = Symbol("CATALOGUE_PORT");
/** Port du domaine scénarios (C2, paquets de scénarios). */
export const SCENARIOS_PORT: unique symbol = Symbol("SCENARIOS_PORT");
/** Port du domaine conception (C3, configuration figée). */
export const CONCEPTION_PORT: unique symbol = Symbol("CONCEPTION_PORT");
/** Port du domaine simulation (C4, résultat de simulation). */
export const SIMULATION_PORT: unique symbol = Symbol("SIMULATION_PORT");
/** Vérification JWT partagée entre les passerelles WS et l'API. */
export const VERIFICATEUR_JWT_PORT: unique symbol = Symbol("VERIFICATEUR_JWT_PORT");
/** Port du domaine évaluation (C5, bilan de mission). */
export const EVALUATION_PORT: unique symbol = Symbol("EVALUATION_PORT");
/** Port du domaine identité (C8, identifiant + langue). */
export const IDENTITE_PORT: unique symbol = Symbol("IDENTITE_PORT");
/** Port du domaine pédagogie (C7, rendu des codes d'explication). */
export const PEDAGOGIE_PORT: unique symbol = Symbol("PEDAGOGIE_PORT");
/** Émission des jetons signés, portée par l'infrastructure serveur. */
export const EMETTEUR_JWT_PORT: unique symbol = Symbol("EMETTEUR_JWT_PORT");
/** Bus d'événements en mémoire (C9) — implémenté dans `apps/server`. */
export const EVENT_BUS: unique symbol = Symbol("EVENT_BUS");

/** Tous les jetons de ports, pour les revues et les tests de frontière. */
export const JETONS_DE_PORTS = [
  CATALOGUE_PORT,
  SCENARIOS_PORT,
  CONCEPTION_PORT,
  SIMULATION_PORT,
  VERIFICATEUR_JWT_PORT,
  EVALUATION_PORT,
  IDENTITE_PORT,
  PEDAGOGIE_PORT,
  EMETTEUR_JWT_PORT,
  EVENT_BUS,
] as const;
