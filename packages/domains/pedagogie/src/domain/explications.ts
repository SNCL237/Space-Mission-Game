import {
  CODES_CAMPAGNE,
  CODES_CONCEPTION_TOUTES,
  CODES_EVALUATION_TOUTES,
  CODES_EXPLICATION_TOUTES,
  CODES_IDENTITE,
  CODES_PEDAGOGIE,
  CODES_SIMULATION_TOUTES,
  CODES_TRANSVERSES,
  type Langue,
} from "@smdg/contracts";

export interface TexteExplication {
  readonly titre: string;
  readonly explication: string;
  readonly piste: string;
}

type Messages = Readonly<Record<Langue, TexteExplication>>;

const codesIdentite = new Set<string>(Object.values(CODES_IDENTITE));
const codesCampagne = new Set<string>(Object.values(CODES_CAMPAGNE));
const codesTransverses = new Set<string>(Object.values(CODES_TRANSVERSES));
const codesPedagogie = new Set<string>(Object.values(CODES_PEDAGOGIE));
const textes: Record<string, Messages> = Object.fromEntries(
  CODES_EXPLICATION_TOUTES.map((code) => [code, creerMessage(code)]),
);

function creerMessage(code: string): Messages {
  if (code.startsWith("PAQUET_")) {
    return {
      fr: {
        titre: "Scénario à corriger",
        explication: "Le paquet ne respecte pas les règles de publication du scénario.",
        piste: "Corrigez les champs signalés puis validez à nouveau le paquet.",
      },
      en: {
        titre: "Scenario needs changes",
        explication: "The package does not meet the scenario publication rules.",
        piste: "Fix the reported fields, then validate the package again.",
      },
    };
  }
  if (codesIdentite.has(code)) {
    return {
      fr: {
        titre: "Compte à vérifier",
        explication: "Les informations du compte ne permettent pas cette action.",
        piste: "Vérifiez vos renseignements et réessayez après correction.",
      },
      en: {
        titre: "Check the account",
        explication: "The account details do not allow this action.",
        piste: "Review your details and try again after correcting them.",
      },
    };
  }
  if (codesCampagne.has(code)) {
    return {
      fr: {
        titre: "Étape de campagne indisponible",
        explication: "La mission, son étape ou son scénario ne correspond pas à la progression.",
        piste: "Reprenez la mission enregistrée ou terminez les conditions précédentes.",
      },
      en: {
        titre: "Campaign step unavailable",
        explication: "The mission, step, or scenario does not match the current progress.",
        piste: "Resume the saved mission or complete the earlier requirements.",
      },
    };
  }
  if (CODES_CONCEPTION_TOUTES.includes(code)) {
    return {
      fr: {
        titre: "Conception à vérifier",
        explication: "Un choix de conception est absent, incompatible ou hors des limites.",
        piste: "Vérifiez les objectifs et sélectionnez des éléments compatibles.",
      },
      en: {
        titre: "Review the design",
        explication: "A design choice is missing, incompatible, or outside the limits.",
        piste: "Check the objectives and select compatible components.",
      },
    };
  }
  if (CODES_SIMULATION_TOUTES.includes(code)) {
    return {
      fr: {
        titre: "Opérations à vérifier",
        explication: "La simulation attend une action valide ou a atteint une limite.",
        piste: "Consultez les alertes et choisissez une action compatible.",
      },
      en: {
        titre: "Review operations",
        explication: "The simulation needs a valid action or has reached a limit.",
        piste: "Check the alerts and choose a compatible action.",
      },
    };
  }
  if (CODES_EVALUATION_TOUTES.includes(code)) {
    return {
      fr: {
        titre: "Résultats de mission à améliorer",
        explication: "Les résultats indiquent un objectif, une ressource ou un risque à revoir.",
        piste: "Adaptez la conception et les opérations aux objectifs prioritaires.",
      },
      en: {
        titre: "Improve mission results",
        explication: "The results point to an objective, resource, or risk to review.",
        piste: "Adjust the design and operations to the priority objectives.",
      },
    };
  }
  if (codesTransverses.has(code)) {
    return {
      fr: {
        titre: "Accès ou requête à vérifier",
        explication: "L’accès, le jeton ou les données envoyées ne sont pas valides.",
        piste: "Reconnectez-vous et vérifiez les informations de la requête.",
      },
      en: {
        titre: "Check access or request",
        explication: "The access, token, or submitted data is not valid.",
        piste: "Sign in again and check the request details.",
      },
    };
  }
  if (codesPedagogie.has(code)) {
    return {
      fr: {
        titre: "Explication indisponible",
        explication: "Le registre pédagogique ne contient pas encore ce code.",
        piste: "Consultez les détails ou demandez une nouvelle explication.",
      },
      en: {
        titre: "Explanation unavailable",
        explication: "The learning registry does not contain this code yet.",
        piste: "Review the details or request another explanation.",
      },
    };
  }
  return {
    fr: {
      titre: "Information de mission",
      explication: "Cette situation demande une vérification avant de continuer.",
      piste: "Consultez les détails et réessayez après correction.",
    },
    en: {
      titre: "Mission information",
      explication: "This situation needs a check before you continue.",
      piste: "Review the details and try again after making a correction.",
    },
  };
}

export function rendreExplication(code: string, langue: Langue): TexteExplication {
  const messages = textes[code];
  if (messages === undefined) throw new Error(`CODE_EXPLICATION_INCONNU — ${code}`);
  return messages[langue];
}

export function verifierCouvertureExplications(): readonly string[] {
  return CODES_EXPLICATION_TOUTES.filter((code) => textes[code] === undefined);
}

export const GLOSSAIRE = {
  fr: [
    { terme: "Orbite", definition: "Trajectoire suivie par un engin autour d’un astre." },
    {
      terme: "Marge",
      definition: "Réserve qui aide la mission à supporter un écart ou un imprévu.",
    },
    { terme: "Télémétrie", definition: "Données envoyées par l’engin pour décrire son état." },
  ],
  en: [
    { terme: "Orbit", definition: "Path followed by a spacecraft around a celestial body." },
    { terme: "Margin", definition: "Reserve that helps a mission handle variation or surprise." },
    { terme: "Telemetry", definition: "Data sent by a spacecraft to describe its status." },
  ],
} as const;
