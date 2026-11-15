import { Inject, Injectable } from "@nestjs/common";
import {
  CATALOGUE_PORT,
  CODES_CONCEPTION,
  schemaReferentielCatalogue,
  type ConfigurationFigee,
  type PortConception,
  type PortCatalogue,
} from "@smdg/contracts";

import { ConfigurationMission } from "../domain/configuration-mission.js";
import { ErreurConception } from "../domain/erreur-conception.js";
import type {
  BilanConception,
  OptionDisponible,
  OptionsConfigurationMission,
  ParametresMission,
  RapportVerification,
} from "../domain/types.js";

export type ModificationConception =
  | { readonly type: "objectifs"; readonly principal?: string; readonly secondaires: string[] }
  | { readonly type: "lancement"; readonly lanceurId: string; readonly orbiteId: string }
  | { readonly type: "ajouter-element"; readonly id: string }
  | { readonly type: "retirer-element"; readonly id: string }
  | { readonly type: "ajouter-instrument"; readonly id: string }
  | {
      readonly type: "associer-objectifs-instrument";
      readonly id: string;
      readonly objectifs: string[];
    }
  | { readonly type: "retirer-instrument"; readonly id: string }
  | { readonly type: "marge-dv"; readonly margeDv: number };

export interface LectureConception {
  readonly configurationId: string;
  readonly bilans?: BilanConception;
  readonly seuils: ReturnType<ConfigurationMission["seuils"]>;
  readonly alertes: RapportVerification["avertissements"];
  readonly erreurs: RapportVerification["erreurs"];
  readonly suggestions: RapportVerification["suggestions"];
  readonly disponible: readonly OptionDisponible[];
  readonly valide: boolean;
}

export type ParametresCreationConception = ParametresMission & {
  readonly versionCatalogue: string;
};

/** Cas d'utilisation CON ; lit C1 via son port, sans dépendance au code CAT. */
@Injectable()
export class ServiceConception implements PortConception {
  private readonly configurations = new Map<string, ConfigurationMission>();

  constructor(@Inject(CATALOGUE_PORT) private readonly catalogue: PortCatalogue) {}

  async creer(parametres: ParametresCreationConception): Promise<ConfigurationMission> {
    const catalogue = await this.catalogue.lire(parametres.versionCatalogue);
    if (catalogue === undefined) {
      throw new ErreurConception({
        version: 1,
        code: CODES_CONCEPTION.CATALOGUE_VERSION_INCONNUE,
        params: { version: parametres.versionCatalogue },
      });
    }
    const parse = schemaReferentielCatalogue.safeParse(catalogue);
    if (!parse.success) {
      throw new ErreurConception({
        version: 1,
        code: CODES_CONCEPTION.CATALOGUE_C1_INVALIDE,
        params: { champs: parse.error.issues.map((issue) => issue.path.join(".")).join(",") },
      });
    }
    const options: OptionsConfigurationMission = {
      ...parametres,
      catalogue: parse.data,
    };
    if (this.configurations.has(parametres.configurationId)) {
      throw new ErreurConception({
        version: 1,
        code: CODES_CONCEPTION.PARAMETRE_MISSION_INVALIDE,
        params: { champ: "configurationId" },
      }, 409);
    }
    const configuration = new ConfigurationMission(options);
    this.configurations.set(parametres.configurationId, configuration);
    return configuration;
  }

  async valider(configurationId: string): Promise<void> {
    const configuration = this.obtenir(configurationId);
    const rapport = configuration.valider();
    if (!rapport.valide) {
      throw new ErreurConception({
        version: 1,
        code: CODES_CONCEPTION.CONFIGURATION_NON_VALIDEE,
        params: {
          erreurs: rapport.erreurs.length,
          codes: rapport.erreurs.map((erreur) => erreur.code).join(","),
        },
      }, 422);
    }
  }

  lire(configurationId: string): LectureConception {
    const configuration = this.obtenir(configurationId);
    const rapport = configuration.verifier();
    return {
      configurationId,
      ...(rapport.bilans !== undefined ? { bilans: rapport.bilans } : {}),
      seuils: configuration.seuils(),
      alertes: rapport.avertissements,
      erreurs: rapport.erreurs,
      suggestions: rapport.suggestions,
      disponible: configuration.optionsDisponibles(),
      valide: rapport.valide,
    };
  }

  modifier(configurationId: string, modification: ModificationConception): void {
    const configuration = this.obtenir(configurationId);
    switch (modification.type) {
      case "objectifs":
        configuration.choisirObjectifs(modification.principal, modification.secondaires);
        return;
      case "lancement":
        configuration.choisirLancement(modification.lanceurId, modification.orbiteId);
        return;
      case "ajouter-element":
        configuration.ajouterElement(modification.id);
        return;
      case "retirer-element":
        configuration.retirerElement(modification.id);
        return;
      case "ajouter-instrument":
        configuration.ajouterInstrument(modification.id);
        return;
      case "associer-objectifs-instrument":
        configuration.associerObjectifsInstrument(modification.id, modification.objectifs);
        return;
      case "retirer-instrument":
        configuration.retirerInstrument(modification.id);
        return;
      case "marge-dv":
        configuration.definirMargeDv(modification.margeDv);
    }
  }

  async figer(configurationId: string): Promise<ConfigurationFigee> {
    return this.obtenir(configurationId).figer();
  }

  private obtenir(configurationId: string): ConfigurationMission {
    const configuration = this.configurations.get(configurationId);
    if (configuration === undefined) {
      throw new ErreurConception({
        version: 1,
        code: CODES_CONCEPTION.PARAMETRE_MISSION_INVALIDE,
        params: { champ: "configurationId" },
      }, 404);
    }
    return configuration;
  }
}
