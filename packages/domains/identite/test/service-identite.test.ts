import type { PortEmetteurJwt, PortIdentite, ProfilIdentite } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { ServiceIdentite } from "../src/application/service-identite.js";
import type { DepotIdentite } from "../src/domain/depot.js";
import type { CompteIdentite } from "../src/domain/types.js";

class DepotMemoire implements DepotIdentite {
  readonly comptes = new Map<string, CompteIdentite>();

  async creer(compte: CompteIdentite): Promise<boolean> {
    if (this.comptes.has(compte.identifiantNormalise)) return false;
    this.comptes.set(compte.identifiantNormalise, compte);
    if (compte.courrielNormalise !== undefined) {
      this.comptes.set(compte.courrielNormalise, compte);
    }
    return true;
  }

  async trouverParIdentifiant(identifiantNormalise: string): Promise<CompteIdentite | undefined> {
    return this.comptes.get(identifiantNormalise);
  }

  async trouverParId(utilisateurId: string): Promise<CompteIdentite | undefined> {
    return [...this.comptes.values()].find((compte) => compte.id === utilisateurId);
  }

  async definirLangue(utilisateurId: string, langue: "fr" | "en"): Promise<boolean> {
    const compte = await this.trouverParId(utilisateurId);
    if (compte === undefined) return false;
    this.comptes.set(compte.identifiantNormalise, { ...compte, langue });
    if (compte.courrielNormalise !== undefined) {
      this.comptes.set(compte.courrielNormalise, { ...compte, langue });
    }
    return true;
  }
}

class EmetteurMemoire implements PortEmetteurJwt {
  async emettre(entree: {
    readonly utilisateurId: string;
    readonly role: "admin" | "joueur";
    readonly dureeSecondes: number;
  }): Promise<string> {
    return `${entree.utilisateurId}:${entree.role}:${entree.dureeSecondes}`;
  }
}

describe("IDE — comptes et mode invité", () => {
  it("crée un invité sans courriel et rattache son profil au jeton", async () => {
    const service: PortIdentite = new ServiceIdentite(new DepotMemoire(), new EmetteurMemoire());
    const resultat = await service.creerInvite("fr");
    expect(resultat.profil.invite).toBe(true);
    expect(resultat.profil.courriel).toBeUndefined();
    expect(resultat.jeton).toContain(resultat.profil.identite.id);
    await expect(service.definirLangue(resultat.profil.identite.id, "en")).resolves.toMatchObject({
      identite: { langue: "en" },
    });
  });

  it("ne persiste qu'un hachage du mot de passe et limite après cinq échecs", async () => {
    const depot = new DepotMemoire();
    const service = new ServiceIdentite(depot, new EmetteurMemoire());
    const resultat = await service.inscrire({
      pseudo: "Joueur",
      courriel: "joueur@example.test",
      motDePasse: "un-mot-de-passe-long",
      langue: "fr",
    });
    const profil: ProfilIdentite = resultat.profil;
    const compte = await depot.trouverParId(profil.identite.id);
    expect(compte?.motDePasseHash).not.toBe("un-mot-de-passe-long");
    expect(compte?.motDePasseHash).toMatch(/^\$2[aby]\$/);

    for (let tentative = 0; tentative < 5; tentative += 1) {
      await expect(
        service.connecter({
          identifiant: "joueur",
          motDePasse: "incorrect",
          adresseIp: "127.0.0.1",
        }),
      ).rejects.toMatchObject({ statut: 401 });
    }
    await expect(
      service.connecter({
        identifiant: "JOUEUR",
        motDePasse: "incorrect",
        adresseIp: "127.0.0.1",
      }),
    ).rejects.toMatchObject({ statut: 429 });
  }, 20_000);

  it("permet une connexion valide et masque la différence entre compte absent et mot de passe erroné", async () => {
    const service = new ServiceIdentite(new DepotMemoire(), new EmetteurMemoire());
    await service.inscrire({
      pseudo: "Joueur",
      motDePasse: "un-mot-de-passe-long",
      langue: "en",
    });
    await expect(
      service.connecter({
        identifiant: "Joueur",
        motDePasse: "un-mot-de-passe-long",
        adresseIp: "127.0.0.2",
      }),
    ).resolves.toMatchObject({ profil: { pseudo: "Joueur" } });
    const err = await service
      .connecter({
        identifiant: "inconnu",
        motDePasse: "incorrect",
        adresseIp: "127.0.0.3",
      })
      .catch((cause: unknown) => cause);
    expect(err).toMatchObject({
      statut: 401,
      explication: { code: "IDENTIFIANT_OU_MOT_DE_PASSE_INVALIDE" },
    });
  });
});
