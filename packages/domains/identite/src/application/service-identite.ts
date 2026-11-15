import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import {
  CODES_IDENTITE,
  EMETTEUR_JWT_PORT,
  type Langue,
  type PortEmetteurJwt,
  type PortIdentite,
  type ProfilIdentite,
} from "@smdg/contracts";

import { DEPOT_IDENTITE, type DepotIdentite } from "../domain/depot.js";
import { ErreurIdentite } from "../domain/erreur-identite.js";
import type { CompteIdentite } from "../domain/types.js";

const COUT_BCRYPT = 12;
const FENETRE_LIMITATION_MS = 60_000;
const MAX_ECHECS = 5;

function normaliser(identifiant: string): string {
  return identifiant.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function expliquer(code: string, params: Record<string, number | string> = {}) {
  return { version: 1, code, params };
}

@Injectable()
export class ServiceIdentite implements PortIdentite {
  private readonly echecsConnexion = new Map<string, { compteur: number; expireA: number }>();

  constructor(
    @Inject(DEPOT_IDENTITE) private readonly depot: DepotIdentite,
    @Inject(EMETTEUR_JWT_PORT) private readonly emetteur: PortEmetteurJwt,
  ) {}

  async creerInvite(langue: Langue): Promise<{ profil: ProfilIdentite; jeton: string }> {
    const id = randomUUID();
    const pseudo = `Invite-${id.slice(0, 8)}`;
    const compte: CompteIdentite = {
      id,
      pseudo,
      identifiantNormalise: normaliser(id),
      motDePasseHash: null,
      langue,
      invite: true,
    };
    const cree = await this.depot.creer(compte);
    if (!cree) throw new Error("CREATION_INVITE_ECHOUEE");
    const profil = this.profil(compte);
    const jeton = await this.emetteur.emettre({
      utilisateurId: id,
      role: "joueur",
      dureeSecondes: 30 * 24 * 60 * 60,
    });
    return { profil, jeton };
  }

  async inscrire(entree: {
    readonly pseudo: string;
    readonly courriel?: string;
    readonly motDePasse: string;
    readonly langue: Langue;
  }): Promise<{ profil: ProfilIdentite; jeton: string }> {
    if (entree.motDePasse.length < 12 || Buffer.byteLength(entree.motDePasse, "utf8") > 72) {
      throw new ErreurIdentite(expliquer(CODES_IDENTITE.MOT_DE_PASSE_INVALIDE), 400);
    }
    const pseudo = entree.pseudo.normalize("NFKC").trim();
    const id = randomUUID();
    const compte: CompteIdentite = {
      id,
      pseudo,
      identifiantNormalise: normaliser(pseudo),
      ...(entree.courriel !== undefined
        ? {
            courriel: entree.courriel.trim(),
            courrielNormalise: normaliser(entree.courriel),
          }
        : {}),
      motDePasseHash: await bcrypt.hash(entree.motDePasse, COUT_BCRYPT),
      langue: entree.langue,
      invite: false,
    };
    if (!(await this.depot.creer(compte))) {
      throw new ErreurIdentite(expliquer(CODES_IDENTITE.COMPTE_DEJA_EXISTANT), 409);
    }
    const profil = this.profil(compte);
    const jeton = await this.emetteur.emettre({
      utilisateurId: id,
      role: "joueur",
      dureeSecondes: 60 * 60,
    });
    return { profil, jeton };
  }

  async connecter(entree: {
    readonly identifiant: string;
    readonly motDePasse: string;
    readonly adresseIp: string;
  }): Promise<{ profil: ProfilIdentite; jeton: string }> {
    const identifiantNormalise = normaliser(entree.identifiant);
    const cleLimite = `${normaliser(entree.adresseIp)}|${identifiantNormalise}`;
    this.verifierLimite(cleLimite);

    const compte = await this.depot.trouverParIdentifiant(identifiantNormalise);
    const motDePasseValide = Buffer.byteLength(entree.motDePasse, "utf8") <= 72;
    const valide =
      compte !== undefined &&
      compte.motDePasseHash !== null &&
      motDePasseValide &&
      (await bcrypt.compare(entree.motDePasse, compte.motDePasseHash));
    if (!valide || compte === undefined) {
      if (compte === undefined || compte.motDePasseHash === null || !motDePasseValide) {
        await bcrypt.hash(entree.motDePasse, COUT_BCRYPT);
      }
      this.enregistrerEchec(cleLimite);
      throw new ErreurIdentite(expliquer(CODES_IDENTITE.IDENTIFIANT_OU_MOT_DE_PASSE_INVALIDE), 401);
    }

    this.echecsConnexion.delete(cleLimite);
    const profil = this.profil(compte);
    const jeton = await this.emetteur.emettre({
      utilisateurId: compte.id,
      role: "joueur",
      dureeSecondes: 60 * 60,
    });
    return { profil, jeton };
  }

  async lireProfil(utilisateurId: string): Promise<ProfilIdentite> {
    const compte = await this.depot.trouverParId(utilisateurId);
    if (compte === undefined) {
      throw new ErreurIdentite(expliquer(CODES_IDENTITE.PROFIL_INCONNU), 404);
    }
    return this.profil(compte);
  }

  async definirLangue(utilisateurId: string, langue: Langue): Promise<ProfilIdentite> {
    if (!(await this.depot.definirLangue(utilisateurId, langue))) {
      throw new ErreurIdentite(expliquer(CODES_IDENTITE.PROFIL_INCONNU), 404);
    }
    return this.lireProfil(utilisateurId);
  }

  private profil(compte: CompteIdentite): ProfilIdentite {
    return {
      identite: { version: 1, id: compte.id, langue: compte.langue },
      pseudo: compte.pseudo,
      ...(compte.courriel !== undefined ? { courriel: compte.courriel } : {}),
      invite: compte.invite,
    };
  }

  private verifierLimite(cle: string): void {
    const maintenant = Date.now();
    for (const [entree, limite] of this.echecsConnexion) {
      if (limite.expireA <= maintenant) this.echecsConnexion.delete(entree);
    }
    const limite = this.echecsConnexion.get(cle);
    if (limite !== undefined && limite.compteur >= MAX_ECHECS) {
      throw new ErreurIdentite(
        expliquer(CODES_IDENTITE.AUTHENTIFICATION_LIMITEE, {
          reessayerApresMs: Math.max(0, limite.expireA - maintenant),
        }),
        429,
      );
    }
  }

  private enregistrerEchec(cle: string): void {
    const maintenant = Date.now();
    const precedente = this.echecsConnexion.get(cle);
    if (precedente === undefined || precedente.expireA <= maintenant) {
      this.echecsConnexion.set(cle, { compteur: 1, expireA: maintenant + FENETRE_LIMITATION_MS });
      return;
    }
    this.echecsConnexion.set(cle, {
      compteur: precedente.compteur + 1,
      expireA: precedente.expireA,
    });
  }
}
