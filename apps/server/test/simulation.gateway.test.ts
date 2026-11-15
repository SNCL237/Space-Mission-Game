import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import type { PortSimulation, PortVerificateurJwt } from "@smdg/contracts";
import type { Socket } from "socket.io";

import { PasserelleSimulationGateway, type PortCampagnePasserelle } from "../src/simulation.gateway.js";

const uuid = (numero: number): string =>
  `${numero.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;

const utilisateurId = uuid(20);
const missionId = uuid(21);

function client(token?: string): {
  socket: Socket;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} {
  const emit = vi.fn(() => true);
  const disconnect = vi.fn();
  const socket = {
    handshake: { auth: token === undefined ? {} : { token } },
    data: {},
    emit,
    disconnect,
  } as unknown as Socket;
  return { socket, emit, disconnect };
}

describe("PasserelleSimulationGateway", () => {
  it("refuses a connection without a JWT or with an administrator JWT", async () => {
    const campagne = {} as PortCampagnePasserelle;
    const simulation = {} as PortSimulation;
    const verifier: PortVerificateurJwt = {
      verifier: async () => ({ utilisateurId, role: "admin" }),
    };
    const gateway = new PasserelleSimulationGateway(campagne, simulation, verifier);
    const sansJeton = client();
    const administrateur = client("admin");

    await gateway.handleConnection(sansJeton.socket);
    await gateway.handleConnection(administrateur.socket);

    expect(sansJeton.disconnect).toHaveBeenCalledWith(true);
    expect(administrateur.disconnect).toHaveBeenCalledWith(true);
  });

  it("orders messages, persists progress, and resumes the saved state after reconnect", async () => {
    let etat = "etat-0";
    const appels: string[] = [];
    const campagne: PortCampagnePasserelle = {
      reprendre: async (id, mission) => {
        appels.push(`reprendre:${id}:${mission}`);
        return { etatSimulation: etat };
      },
      avancerSimulation: async (_id, _mission, _commandes, jours) => {
        await new Promise((resolve) => setTimeout(resolve, jours === 1 ? 10 : 0));
        etat = jours === 1 ? "etat-1" : "etat-2";
        appels.push(`avancer:${jours}`);
        return { etatSimulation: etat };
      },
      deciderCrise: async () => ({ etatSimulation: etat }),
    };
    const simulation: PortSimulation = {
      demarrer: () => {
        throw new Error("non utilisé");
      },
      avancer: () => {
        throw new Error("non utilisé");
      },
      decider: () => {
        throw new Error("non utilisé");
      },
      terminer: () => {
        throw new Error("non utilisé");
      },
      progression: (serialise) => ({
        jour: Number(serialise.at(-1)),
        dureeCibleJours: 6,
        batterieWh: 400,
        tamponGbit: 0,
        scienceCumulee: 0,
        terminee: false,
      }),
    };
    const verifier: PortVerificateurJwt = {
      verifier: async (jeton) => {
        if (jeton !== "valide") throw new Error("jeton inattendu");
        return { utilisateurId, role: "joueur" };
      },
    };
    const gateway = new PasserelleSimulationGateway(campagne, simulation, verifier);
    const premiere = client("valide");
    await gateway.handleConnection(premiere.socket);
    await gateway.demarrer(premiere.socket, { missionId });

    const avances = [
      gateway.avancer(premiere.socket, { commandes: [], jours: 1 }),
      gateway.avancer(premiere.socket, { commandes: [], jours: 2 }),
    ];
    await Promise.all(avances);

    expect(appels).toEqual([
      `reprendre:${utilisateurId}:${missionId}`,
      "avancer:1",
      "avancer:2",
    ]);
    expect(
      premiere.emit.mock.calls
        .filter(([evenement]) => evenement === "simulation.progression")
        .map(([, progression]) => progression),
    ).toMatchObject([{ jour: 0 }, { jour: 1 }, { jour: 2 }]);

    gateway.handleDisconnect(premiere.socket);
    const reconnexion = client("valide");
    await gateway.handleConnection(reconnexion.socket);
    await gateway.demarrer(reconnexion.socket, { missionId });
    expect(appels.at(-1)).toBe(`reprendre:${utilisateurId}:${missionId}`);
    expect(reconnexion.emit).toHaveBeenCalledWith(
      "simulation.progression",
      expect.objectContaining({ jour: 2 }),
    );
  });
});
