import {
  CODES_CONCEPTION,
  schemaConfigurationFigee,
  type CodeExplication,
  type ComposantCatalogue,
  type ConfigurationFigee,
  type InstrumentCatalogue,
  type LanceurCatalogue,
  type OrbiteCatalogue,
} from "@smdg/contracts";
import { capaciteBatterieMin, tsiolkovski } from "@smdg/physics";

import { ErreurConception } from "./erreur-conception.js";
import type {
  BilanConception,
  DeltaConception,
  EcartVariantes,
  OptionDisponible,
  OptionsConfigurationMission,
  RapportVerification,
  SelectionElement,
  SelectionInstrument,
} from "./types.js";

const CATEGORIE_PANNEAU = "energie-panneau";
const CATEGORIE_BATTERIE = "energie-batterie";
const CATEGORIE_PROPULSION = "propulsion";
const DIFFICULTES = { decouverte: 0, ingenieur: 1, expert: 2 } as const;
const SEUIL_ORANGE_DEFAUT = 0.9;
const SEUIL_ROUGE_DEFAUT = 1;
const SEUIL_MARGE_DEFAUT = 0.9;

function expliquer(code: string, params: Record<string, number | string> = {}): CodeExplication {
  return { version: 1, code, params };
}

function additionner(valeurs: readonly number[]): number {
  return [...valeurs].sort((a, b) => a - b).reduce((total, valeur) => total + valeur, 0);
}

function figerProfond<T>(valeur: T): T {
  if (typeof valeur !== "object" || valeur === null || Object.isFrozen(valeur)) return valeur;
  for (const enfant of Object.values(valeur)) figerProfond(enfant);
  return Object.freeze(valeur);
}

function niveauSuffisant(
  niveau: ComposantCatalogue["niveau"],
  difficulte: OptionsConfigurationMission["difficulte"],
): boolean {
  return DIFFICULTES[niveau] <= DIFFICULTES[difficulte];
}

/** Configuration métier CON : calculs purs à partir de C1 et des paramètres de mission. */
export class ConfigurationMission {
  private readonly elements: SelectionElement[] = [];
  private readonly instruments: SelectionInstrument[] = [];
  private readonly versionsFigees = new Map<number, ConfigurationFigee>();
  private readonly variantesComparees = new Set<string>();
  private objectifPrincipal: string | undefined;
  private objectifsSecondaires: string[] = [];
  private lanceurId: string | undefined;
  private orbiteId: string | undefined;
  private margeDv: number;
  private numeroVersion = 0;
  private validee = false;
  private figeeCourante = false;

  constructor(private readonly options: OptionsConfigurationMission) {
    this.validerParametres(options);
    this.margeDv = options.margeDv;
  }

  choisirObjectifs(principal: string | undefined, secondaires: readonly string[]): void {
    this.objectifPrincipal = principal;
    this.objectifsSecondaires = [...secondaires];
    this.modifier();
  }

  choisirLancement(lanceurId: string, orbiteId: string): void {
    if (!this.options.catalogue.lanceurs.some((lanceur) => lanceur.id === lanceurId)) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: lanceurId }),
      );
    }
    if (!this.options.catalogue.orbites.some((orbite) => orbite.id === orbiteId)) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: orbiteId }),
      );
    }
    this.lanceurId = lanceurId;
    this.orbiteId = orbiteId;
    this.modifier();
  }

  ajouterElement(idCatalogue: string): void {
    const catalogue = this.options.catalogue.composants.find((item) => item.id === idCatalogue);
    if (catalogue === undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: idCatalogue }),
      );
    }
    if (!niveauSuffisant(catalogue.niveau, this.options.difficulte)) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_INDISPONIBLE, {
          option: idCatalogue,
          raison: this.options.difficulte,
        }),
      );
    }
    this.elements.push({ catalogue: structuredClone(catalogue) });
    this.modifier();
  }

  retirerElement(idCatalogue: string): void {
    const index = this.elements.findIndex((selection) => selection.catalogue.id === idCatalogue);
    if (index < 0) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: idCatalogue }),
      );
    }
    this.elements.splice(index, 1);
    this.modifier();
  }

  ajouterInstrument(idCatalogue: string): void {
    const catalogue = this.options.catalogue.instruments.find((item) => item.id === idCatalogue);
    if (catalogue === undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: idCatalogue }),
      );
    }
    const incompatibilite = this.incompatibiliteObjectif(catalogue);
    if (incompatibilite !== undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_INDISPONIBLE, {
          option: idCatalogue,
          objectif: incompatibilite,
        }),
      );
    }
    this.instruments.push({ catalogue: structuredClone(catalogue), objectifs: [] });
    this.modifier();
  }

  associerObjectifsInstrument(idCatalogue: string, objectifs: readonly string[]): void {
    const selection = this.instruments.find(
      (instrument) => instrument.catalogue.id === idCatalogue,
    );
    if (selection === undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: idCatalogue }),
      );
    }
    const disponibles = new Set(
      [this.objectifPrincipal, ...this.objectifsSecondaires].filter(
        (objectif): objectif is string => objectif !== undefined,
      ),
    );
    const objectifsUniques = [...new Set(objectifs)];
    if (
      objectifsUniques.length === 0 ||
      objectifsUniques.some((objectif) => !disponibles.has(objectif))
    ) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OBJECTIF_INSTRUMENT_INVALIDE, {
          instrument: idCatalogue,
        }),
      );
    }
    selection.objectifs = objectifsUniques;
    this.modifier();
  }

  retirerInstrument(idCatalogue: string): void {
    const index = this.instruments.findIndex((selection) => selection.catalogue.id === idCatalogue);
    if (index < 0) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.OPTION_CATALOGUE_INCONNUE, { option: idCatalogue }),
      );
    }
    this.instruments.splice(index, 1);
    this.modifier();
  }

  definirMargeDv(margeDv: number): void {
    if (!Number.isFinite(margeDv) || margeDv < 0) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.PARAMETRE_MISSION_INVALIDE, { champ: "margeDv" }),
      );
    }
    this.margeDv = margeDv;
    this.modifier();
  }

  optionsDisponibles(): OptionDisponible[] {
    const composants = this.options.catalogue.composants.map((composant): OptionDisponible => ({
      id: composant.id,
      type: "composant",
      disponible: niveauSuffisant(composant.niveau, this.options.difficulte),
      ...(!niveauSuffisant(composant.niveau, this.options.difficulte)
        ? { raison: CODES_CONCEPTION.OPTION_INDISPONIBLE }
        : {}),
    }));
    const instruments = this.options.catalogue.instruments.map((instrument): OptionDisponible => {
      const incompatibilite = this.incompatibiliteObjectif(instrument);
      return {
        id: instrument.id,
        type: "instrument",
        disponible: incompatibilite === undefined,
        ...(incompatibilite !== undefined ? { raison: CODES_CONCEPTION.OPTION_INDISPONIBLE } : {}),
      };
    });
    return [...composants, ...instruments];
  }

  seuils(): { alerteOrange: number; erreurRouge: number; margeFaible: number } {
    return {
      alerteOrange: this.seuilOrange(),
      erreurRouge: this.seuilRouge(),
      margeFaible: this.seuilMargeFaible(),
    };
  }

  calculerBilans(): BilanConception {
    const composants = this.elements.map((selection) => selection.catalogue);
    const instruments = this.instruments.map((selection) => selection.catalogue);
    const masseSecheKg = additionner([
      ...composants.map((composant) => composant.masseKg),
      ...instruments.map((instrument) => instrument.masseKg),
    ]);

    const moteurs = composants.filter((composant) => composant.categorie === CATEGORIE_PROPULSION);
    const isp = this.resoudreIsp(moteurs);
    const carburantKg =
      this.options.deltaVms === 0 || isp === undefined
        ? 0
        : tsiolkovski(masseSecheKg, this.options.deltaVms, isp, this.margeDv);

    const puissanceConsommeeW = additionner([
      ...composants
        .filter(
          (composant) =>
            composant.categorie !== CATEGORIE_PANNEAU && composant.categorie !== CATEGORIE_BATTERIE,
        )
        .map((composant) => composant.powerW * this.dutyCycle(composant)),
      ...instruments.map((instrument) => instrument.powerW * this.dutyCycle(instrument)),
    ]);

    const panneaux = composants.filter((composant) => composant.categorie === CATEGORIE_PANNEAU);
    const puissanceProduiteW = additionner(
      panneaux.map((panneau) => {
        const degradation = panneau.degradationAn;
        if (degradation === undefined) {
          throw new ErreurConception(
            expliquer(CODES_CONCEPTION.PARAMETRE_CATALOGUE_MANQUANT, {
              option: panneau.id,
              champ: "degradationAn",
            }),
          );
        }
        const restant = 1 - degradation * this.options.dureeMissionAns;
        if (restant < 0) {
          throw new ErreurConception(
            expliquer(CODES_CONCEPTION.PARAMETRE_MISSION_INVALIDE, {
              champ: "degradationAn",
              option: panneau.id,
            }),
          );
        }
        return panneau.powerW * this.dutyCycle(panneau) * restant;
      }),
    );

    const batteries = composants.filter((composant) => composant.categorie === CATEGORIE_BATTERIE);
    const capaciteBatterieWh = additionner(
      batteries.map((batterie) => {
        if (batterie.capaciteBatterieWh === undefined) {
          throw new ErreurConception(
            expliquer(CODES_CONCEPTION.PARAMETRE_CATALOGUE_MANQUANT, {
              option: batterie.id,
              champ: "capaciteBatterieWh",
            }),
          );
        }
        return batterie.capaciteBatterieWh;
      }),
    );
    const orbite = this.trouverOrbite();
    const capaciteBatterieMinWh = capaciteBatterieMin(
      puissanceConsommeeW,
      orbite.fractionOmbre,
      orbite.periodeS,
      this.options.profondeurDecharge,
      this.options.rendement,
    );
    const coutMUSD =
      additionner([
        ...composants.map((composant) => composant.costMUSD),
        ...instruments.map((instrument) => instrument.costMUSD),
        this.trouverLanceur()?.costMUSD ?? 0,
      ]) +
      this.options.coutOperationsAnnuelMUSD * this.options.dureeMissionAns;
    const debitGenereGbitJour = additionner(
      instruments.map(
        (instrument) =>
          (instrument.dataMbps *
            this.dutyCycle(instrument) *
            this.options.tempsObservationSParJour) /
          1000,
      ),
    );

    return {
      masseSecheKg,
      carburantKg,
      masseTotaleKg: masseSecheKg + carburantKg,
      puissanceProduiteW,
      puissanceConsommeeW,
      capaciteBatterieWh,
      capaciteBatterieMinWh,
      coutMUSD,
      debitGenereGbitJour,
    };
  }

  verifier(): RapportVerification {
    const erreurs: CodeExplication[] = [];
    const avertissements: CodeExplication[] = [];
    const suggestions: CodeExplication[] = [];

    if (this.objectifPrincipal === undefined) {
      erreurs.push(expliquer(CODES_CONCEPTION.OBJECTIF_PRINCIPAL_REQUIS));
    }
    if (this.objectifsSecondaires.length === 0) {
      avertissements.push(expliquer(CODES_CONCEPTION.OBJECTIFS_SECONDAIRES_ABSENTS));
    }
    if (this.objectifsSecondaires.length > 2) {
      erreurs.push(
        expliquer(CODES_CONCEPTION.OBJECTIFS_TROP_NOMBREUX, {
          nombre: this.objectifsSecondaires.length,
          maximum: 2,
        }),
      );
    }
    const maximumSecondaires = DIFFICULTES[this.options.difficulte];
    if (this.objectifsSecondaires.length > maximumSecondaires) {
      erreurs.push(
        expliquer(CODES_CONCEPTION.NIVEAU_OBJECTIFS_INVALIDE, {
          difficulte: this.options.difficulte,
          nombre: this.objectifsSecondaires.length,
          maximum: maximumSecondaires,
        }),
      );
    }
    for (const instrument of this.instruments) {
      if (instrument.objectifs.length === 0) {
        erreurs.push(
          expliquer(CODES_CONCEPTION.OBJECTIFS_INSTRUMENT_REQUIS, {
            instrument: instrument.catalogue.id,
          }),
        );
      } else {
        const objectifsDisponibles = new Set(
          [this.objectifPrincipal, ...this.objectifsSecondaires].filter(
            (objectif): objectif is string => objectif !== undefined,
          ),
        );
        if (instrument.objectifs.some((objectif) => !objectifsDisponibles.has(objectif))) {
          erreurs.push(
            expliquer(CODES_CONCEPTION.OBJECTIF_INSTRUMENT_INVALIDE, {
              instrument: instrument.catalogue.id,
            }),
          );
        }
      }
      const incompatibilite = this.incompatibiliteObjectif(instrument.catalogue);
      if (incompatibilite !== undefined) {
        erreurs.push(
          expliquer(CODES_CONCEPTION.OPTION_INDISPONIBLE, {
            option: instrument.catalogue.id,
            objectif: incompatibilite,
          }),
        );
      }
    }

    if (this.lanceurId === undefined) {
      erreurs.push(expliquer(CODES_CONCEPTION.LANCEUR_REQUIS));
    }
    if (this.orbiteId === undefined) {
      erreurs.push(expliquer(CODES_CONCEPTION.ORBITE_REQUISE));
    }

    let bilans: BilanConception | undefined;
    try {
      bilans = this.calculerBilans();
    } catch (erreur) {
      if (!(erreur instanceof ErreurConception)) throw erreur;
      if (erreur.code !== CODES_CONCEPTION.ORBITE_REQUISE || this.orbiteId !== undefined) {
        erreurs.push(erreur.explication);
      }
    }

    if (bilans !== undefined) {
      const lanceur = this.trouverLanceur();
      const orbite = this.trouverOrbite();
      if (lanceur !== undefined && orbite !== undefined) {
        const capaciteKg = lanceur.capaciteKg[orbite.type];
        if (capaciteKg === undefined) {
          erreurs.push(
            expliquer(CODES_CONCEPTION.ORBITE_INACCESSIBLE, {
              lanceur: lanceur.id,
              orbite: orbite.type,
            }),
          );
        } else {
          const ratioMasse = bilans.masseTotaleKg / capaciteKg;
          if (ratioMasse > 1) {
            erreurs.push(
              expliquer(CODES_CONCEPTION.MASSE_DEPASSE, {
                ecartKg: bilans.masseTotaleKg - capaciteKg,
                masseKg: bilans.masseTotaleKg,
                capaciteKg,
              }),
            );
            suggestions.push(
              expliquer(CODES_CONCEPTION.PISTE_REDUIS_MASSE, {
                ecartKg: bilans.masseTotaleKg - capaciteKg,
              }),
              expliquer(CODES_CONCEPTION.PISTE_AUTRE_ORBITE, { orbite: orbite.type }),
              expliquer(CODES_CONCEPTION.PISTE_AUTRE_LANCEUR, { lanceur: lanceur.id }),
            );
          } else if (ratioMasse > this.seuilMargeFaible()) {
            avertissements.push(
              expliquer(CODES_CONCEPTION.MARGE_FAIBLE, {
                pourcentage: ratioMasse * 100,
                masseKg: bilans.masseTotaleKg,
                capaciteKg,
              }),
            );
          }
        }
      }

      // B4 (audit) : la batterie ne se recharge qu'au soleil. Il faut comparer la consommation
      // à la production MOYENNE sur l'orbite, P × (1 − fraction d'ombre), comme la simulation.
      const fractionOmbre =
        this.orbiteId === undefined
          ? 0
          : (this.options.catalogue.orbites.find((o) => o.id === this.orbiteId)?.fractionOmbre ?? 0);
      const produiteMoyenneW = bilans.puissanceProduiteW * (1 - fractionOmbre);
      const ratioPuissance =
        produiteMoyenneW === 0
          ? bilans.puissanceConsommeeW === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : bilans.puissanceConsommeeW / produiteMoyenneW;
      if (ratioPuissance >= this.seuilRouge()) {
        erreurs.push(
          expliquer(CODES_CONCEPTION.PUISSANCE_DEPASSEE, {
            consommeeW: bilans.puissanceConsommeeW,
            produiteW: bilans.puissanceProduiteW,
            produiteMoyenneW,
            pourcentage: Number.isFinite(ratioPuissance) ? ratioPuissance * 100 : "infini",
          }),
        );
      } else if (ratioPuissance > this.seuilOrange()) {
        avertissements.push(
          expliquer(CODES_CONCEPTION.PUISSANCE_ALERTE, {
            consommeeW: bilans.puissanceConsommeeW,
            produiteW: bilans.puissanceProduiteW,
            produiteMoyenneW,
            pourcentage: ratioPuissance * 100,
          }),
        );
      }
      if (bilans.capaciteBatterieWh < bilans.capaciteBatterieMinWh) {
        erreurs.push(
          expliquer(CODES_CONCEPTION.BATTERIE_INSUFFISANTE, {
            capaciteWh: bilans.capaciteBatterieWh,
            minimumWh: bilans.capaciteBatterieMinWh,
            ecartWh: bilans.capaciteBatterieMinWh - bilans.capaciteBatterieWh,
          }),
        );
      }

      const ratioBudget = bilans.coutMUSD / this.options.budgetMaxMUSD;
      if (ratioBudget > 1) {
        erreurs.push(
          expliquer(CODES_CONCEPTION.BUDGET_DEPASSE, {
            coutMUSD: bilans.coutMUSD,
            budgetMUSD: this.options.budgetMaxMUSD,
            pourcentage: ratioBudget * 100,
          }),
        );
      } else if (ratioBudget >= this.seuilOrange()) {
        avertissements.push(
          expliquer(CODES_CONCEPTION.BUDGET_ALERTE, {
            coutMUSD: bilans.coutMUSD,
            budgetMUSD: this.options.budgetMaxMUSD,
            pourcentage: ratioBudget * 100,
          }),
        );
      }
    }

    return {
      valide: erreurs.length === 0,
      erreurs,
      avertissements,
      suggestions,
      ...(bilans !== undefined ? { bilans } : {}),
    };
  }

  valider(): RapportVerification {
    const rapport = this.verifier();
    this.validee = rapport.valide;
    if (!rapport.valide) this.figeeCourante = false;
    return rapport;
  }

  figer(): ConfigurationFigee {
    const rapport = this.valider();
    if (!rapport.valide || rapport.bilans === undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.CONFIGURATION_NON_VALIDEE, {
          erreurs: rapport.erreurs.length,
        }),
      );
    }
    const lanceur = this.trouverLanceur();
    const orbite = this.trouverOrbite();
    if (lanceur === undefined || orbite === undefined) {
      throw new ErreurConception(expliquer(CODES_CONCEPTION.CONFIGURATION_NON_VALIDEE));
    }
    const capaciteKg = lanceur.capaciteKg[orbite.type];
    if (capaciteKg === undefined) {
      throw new ErreurConception(expliquer(CODES_CONCEPTION.ORBITE_INACCESSIBLE));
    }

    this.numeroVersion += 1;
    const document = schemaConfigurationFigee.parse({
      version: this.numeroVersion,
      configurationId: this.options.configurationId,
      scenarioId: this.options.scenarioId,
      versionScenario: this.options.versionScenario,
      versionCatalogue: this.options.catalogue.version,
      orbiteur: {
        masseSecheKg: rapport.bilans.masseSecheKg,
        carburantKg: rapport.bilans.carburantKg,
        puissanceProduiteW: rapport.bilans.puissanceProduiteW,
        puissanceConsommeeW: rapport.bilans.puissanceConsommeeW,
        capaciteBatterieWh: rapport.bilans.capaciteBatterieWh,
        coutMUSD: rapport.bilans.coutMUSD,
        elements: this.elements.map(({ catalogue: item }) => ({
          idCatalogue: item.id,
          categorie: item.categorie,
          masseKg: item.masseKg,
          powerW: item.powerW,
          dutyCycle: this.dutyCycle(item),
          costMUSD: item.costMUSD,
          fiabilite: item.fiabilite,
        })),
        instruments: this.instruments.map(({ catalogue: item, objectifs }) => ({
          idCatalogue: item.id,
          objectifs,
          ...(item.missionsReelles !== undefined ? { missionsReelles: item.missionsReelles } : {}),
          masseKg: item.masseKg,
          powerW: item.powerW,
          dutyCycle: this.dutyCycle(item),
          costMUSD: item.costMUSD,
          dataMbps: item.dataMbps,
          valeurScientifique: item.valeurScientifique,
          fiabilite: item.fiabilite,
        })),
      },
      orbite: {
        type: orbite.type,
        altitudeKm: orbite.altitudeKm,
        inclinaisonDeg: orbite.inclinaisonDeg,
        fractionEclipse: orbite.fractionOmbre,
      },
      lanceur: { id: lanceur.id, capaciteKg, fiabilite: lanceur.fiabilite },
      objectifs: {
        principal: this.objectifPrincipal,
        secondaires: [...this.objectifsSecondaires],
      },
      margeDv: this.margeDv,
      difficulte: this.options.difficulte,
      ...(this.options.profilOperations !== undefined
        ? { profilOperations: structuredClone(this.options.profilOperations) }
        : {}),
      bilans: [
        {
          type: "masse",
          capacite: capaciteKg,
          consomme: rapport.bilans.masseTotaleKg,
          seuilAlerte: this.seuilMargeFaible(),
        },
        {
          type: "puissance",
          capacite: rapport.bilans.puissanceProduiteW,
          consomme: rapport.bilans.puissanceConsommeeW,
          seuilAlerte: this.seuilOrange(),
        },
        {
          type: "batterie",
          capacite: rapport.bilans.capaciteBatterieWh,
          consomme: rapport.bilans.capaciteBatterieMinWh,
          seuilAlerte: this.seuilOrange(),
        },
        {
          type: "budget",
          capacite: this.options.budgetMaxMUSD,
          consomme: rapport.bilans.coutMUSD,
          seuilAlerte: this.seuilOrange(),
        },
      ],
    });
    const fige = figerProfond(document);
    this.versionsFigees.set(fige.version, fige);
    this.figeeCourante = true;
    return fige;
  }

  lireVersionFigee(version: number): ConfigurationFigee | undefined {
    return this.versionsFigees.get(version);
  }

  estimerImpact(delta: DeltaConception): BilanConception {
    const copie = new ConfigurationMission({
      ...this.options,
      catalogue: this.options.catalogue,
      configurationId: this.options.configurationId,
      margeDv: this.margeDv,
    });
    copie.objectifPrincipal = this.objectifPrincipal;
    copie.objectifsSecondaires = [...this.objectifsSecondaires];
    copie.lanceurId = this.lanceurId;
    copie.orbiteId = this.orbiteId;
    copie.elements.push(...structuredClone(this.elements));
    copie.instruments.push(...structuredClone(this.instruments));
    if (delta.margeDv !== undefined) copie.definirMargeDv(delta.margeDv);
    for (const id of delta.retirerElements ?? []) copie.retirerElement(id);
    for (const id of delta.retirerInstruments ?? []) copie.retirerInstrument(id);
    for (const id of delta.ajouterElements ?? []) copie.ajouterElement(id);
    for (const id of delta.ajouterInstruments ?? []) copie.ajouterInstrument(id);
    if (delta.lanceurId !== undefined || delta.orbiteId !== undefined) {
      const lanceurId = delta.lanceurId ?? copie.lanceurId;
      const orbiteId = delta.orbiteId ?? copie.orbiteId;
      if (lanceurId === undefined || orbiteId === undefined) {
        throw new ErreurConception(expliquer(CODES_CONCEPTION.LANCEUR_REQUIS));
      }
      copie.choisirLancement(lanceurId, orbiteId);
    }
    return copie.calculerBilans();
  }

  comparerAvec(autre: ConfigurationMission): EcartVariantes {
    const bilan = this.calculerBilans();
    const autreBilan = autre.calculerBilans();
    this.variantesComparees.add(autre.options.configurationId);
    return {
      masseTotaleKg: bilan.masseTotaleKg - autreBilan.masseTotaleKg,
      carburantKg: bilan.carburantKg - autreBilan.carburantKg,
      puissanceConsommeeW: bilan.puissanceConsommeeW - autreBilan.puissanceConsommeeW,
      coutMUSD: bilan.coutMUSD - autreBilan.coutMUSD,
    };
  }

  niveauMaturite(): 0 | 1 | 2 | 3 | 4 {
    if (this.figeeCourante) return 4;
    if (this.validee && this.variantesComparees.size >= 2) return 3;
    if (this.validee) return 2;
    return this.objectifPrincipal === undefined ? 0 : 1;
  }

  private modifier(): void {
    this.validee = false;
    this.figeeCourante = false;
    this.variantesComparees.clear();
  }

  private validerParametres(options: OptionsConfigurationMission): void {
    const nombres: readonly [string, number, boolean][] = [
      ["budgetMaxMUSD", options.budgetMaxMUSD, options.budgetMaxMUSD > 0],
      ["deltaVms", options.deltaVms, options.deltaVms >= 0],
      ["margeDv", options.margeDv, options.margeDv >= 0],
      ["dureeMissionAns", options.dureeMissionAns, options.dureeMissionAns >= 0],
      [
        "coutOperationsAnnuelMUSD",
        options.coutOperationsAnnuelMUSD,
        options.coutOperationsAnnuelMUSD >= 0,
      ],
      [
        "profondeurDecharge",
        options.profondeurDecharge,
        options.profondeurDecharge > 0 && options.profondeurDecharge <= 1,
      ],
      ["rendement", options.rendement, options.rendement > 0 && options.rendement <= 1],
      [
        "tempsObservationSParJour",
        options.tempsObservationSParJour,
        options.tempsObservationSParJour >= 0,
      ],
    ];
    for (const [champ, valeur, valide] of nombres) {
      if (!Number.isFinite(valeur) || !valide) {
        throw new ErreurConception(
          expliquer(CODES_CONCEPTION.PARAMETRE_MISSION_INVALIDE, { champ }),
        );
      }
    }
  }

  private dutyCycle(item: {
    readonly id?: string | undefined;
    readonly dutyCycle?: number | undefined;
  }): number {
    if (item.dutyCycle === undefined) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.PARAMETRE_CATALOGUE_MANQUANT, {
          ...(item.id !== undefined ? { option: item.id } : {}),
          champ: "dutyCycle",
        }),
      );
    }
    return item.dutyCycle;
  }

  private resoudreIsp(moteurs: readonly ComposantCatalogue[]): number | undefined {
    if (this.options.deltaVms === 0) return undefined;
    if (moteurs.length === 0) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.PROPULSION_CONFIGURATION_INVALIDE, {
          raison: "propulsion-absente",
        }),
      );
    }
    const isps = moteurs.map((moteur) => {
      if (moteur.ispS === undefined) {
        throw new ErreurConception(
          expliquer(CODES_CONCEPTION.PARAMETRE_CATALOGUE_MANQUANT, {
            option: moteur.id,
            champ: "ispS",
          }),
        );
      }
      return moteur.ispS;
    });
    if (isps.some((isp) => isp !== isps[0])) {
      throw new ErreurConception(
        expliquer(CODES_CONCEPTION.PROPULSION_CONFIGURATION_INVALIDE, {
          raison: "isp-multiples",
        }),
      );
    }
    return isps[0];
  }

  private trouverLanceur(): LanceurCatalogue | undefined {
    return this.lanceurId === undefined
      ? undefined
      : this.options.catalogue.lanceurs.find((item) => item.id === this.lanceurId);
  }

  private trouverOrbite(): OrbiteCatalogue {
    const orbite =
      this.orbiteId === undefined
        ? undefined
        : this.options.catalogue.orbites.find((item) => item.id === this.orbiteId);
    if (orbite === undefined) {
      throw new ErreurConception(expliquer(CODES_CONCEPTION.ORBITE_REQUISE));
    }
    return orbite;
  }

  private incompatibiliteObjectif(instrument: InstrumentCatalogue): string | undefined {
    const objectifs = [
      ...(this.objectifPrincipal === undefined ? [] : [this.objectifPrincipal]),
      ...this.objectifsSecondaires,
    ];
    return instrument.incompatiblesAvec?.find((objectif) => objectifs.includes(objectif));
  }

  private seuilOrange(): number {
    return this.options.catalogue.seuils["alerteOrange"] ?? SEUIL_ORANGE_DEFAUT;
  }

  private seuilRouge(): number {
    return this.options.catalogue.seuils["alerteRouge"] ?? SEUIL_ROUGE_DEFAUT;
  }

  private seuilMargeFaible(): number {
    return this.options.catalogue.seuils["margeFaible"] ?? SEUIL_MARGE_DEFAUT;
  }
}
