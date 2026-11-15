import { Inject, UnauthorizedException } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets";
import {
  CODES_CAMPAGNE,
  CODES_SIMULATION,
  schemaChoixCrise,
  schemaCommandeSimulation,
  schemaId,
  SIMULATION_PORT,
  VERIFICATEUR_JWT_PORT,
  type PortSimulation,
  type PortVerificateurJwt,
} from "@smdg/contracts";
import type { Socket } from "socket.io";
import { z } from "zod";

import { ErreurCampagne, ServiceCampagne, type MissionCampagne } from "@smdg/campagne";
import { ErreurSimulation } from "@smdg/simulation";

export interface PortCampagnePasserelle {
  reprendre(utilisateurId: string, missionId: string): Promise<Pick<MissionCampagne, "etatSimulation">>;
  avancerSimulation(
    utilisateurId: string,
    missionId: string,
    commandes: readonly z.infer<typeof schemaCommandeSimulation>[],
    jours: number,
  ): Promise<Pick<MissionCampagne, "etatSimulation">>;
  deciderCrise(
    utilisateurId: string,
    missionId: string,
    choix: z.infer<typeof schemaChoixCrise>,
    cibleId?: string,
  ): Promise<Pick<MissionCampagne, "etatSimulation">>;
}

const schemaDemandeDemarrage = z.object({ missionId: schemaId }).strict();
const schemaDemandeAvance = z
  .object({
    commandes: z.array(schemaCommandeSimulation),
    jours: z.number().int().positive(),
  })
  .strict();
const schemaDemandeDecision = z
  .object({
    choix: schemaChoixCrise,
    cibleId: schemaId.optional(),
  })
  .strict();

@WebSocketGateway({ namespace: "/simulation" })
export class PasserelleSimulationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly clientsAutorises = new WeakSet<Socket>();
  private readonly missions = new WeakMap<Socket, string>();
  private readonly files = new WeakMap<Socket, Promise<void>>();

  constructor(
    @Inject(ServiceCampagne) private readonly campagne: PortCampagnePasserelle,
    @Inject(SIMULATION_PORT) private readonly simulation: PortSimulation,
    @Inject(VERIFICATEUR_JWT_PORT) private readonly verificateur: PortVerificateurJwt,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const jeton: unknown = client.handshake.auth?.token;
    if (typeof jeton !== "string" || jeton.length === 0) {
      client.disconnect(true);
      return;
    }
    try {
      const identite = await this.verificateur.verifier(jeton);
      if (identite.role !== "joueur") {
        client.disconnect(true);
        return;
      }
      client.data.utilisateurId = identite.utilisateurId;
      this.clientsAutorises.add(client);
    } catch (erreur: unknown) {
      if (erreur instanceof UnauthorizedException) {
        client.disconnect(true);
        return;
      }
      throw erreur;
    }
  }

  handleDisconnect(client: Socket): void {
    this.missions.delete(client);
    this.files.delete(client);
    this.clientsAutorises.delete(client);
  }

  @SubscribeMessage("simulation.demarrer")
  demarrer(@ConnectedSocket() client: Socket, @MessageBody() donnees: unknown): Promise<void> {
    if (!this.estAutorise(client)) return Promise.resolve();
    const demande = schemaDemandeDemarrage.safeParse(donnees);
    if (!demande.success) {
      this.emettreErreur(
        client,
        CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE,
        demande.error.issues.map((issue) => issue.path.join(".")).join(","),
      );
      return Promise.resolve();
    }
    return this.ordonner(client, async () => {
      try {
        const mission = await this.campagne.reprendre(
          this.utilisateurId(client),
          demande.data.missionId,
        );
        if (mission.etatSimulation === null) {
          this.emettreErreur(client, CODES_CAMPAGNE.MISSION_NON_PRETE, "mission-non-lancee");
          return;
        }
        this.missions.set(client, demande.data.missionId);
        this.emettreProgression(client, mission.etatSimulation);
      } catch (erreur: unknown) {
        this.gererErreurAttendue(client, erreur);
      }
    });
  }

  @SubscribeMessage("simulation.avancer")
  avancer(@ConnectedSocket() client: Socket, @MessageBody() donnees: unknown): Promise<void> {
    if (!this.estAutorise(client)) return Promise.resolve();
    const demande = schemaDemandeAvance.safeParse(donnees);
    if (!demande.success) {
      this.emettreErreur(
        client,
        CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE,
        demande.error.issues.map((issue) => issue.path.join(".")).join(","),
      );
      return Promise.resolve();
    }
    return this.ordonner(client, async () => {
      const missionId = this.missions.get(client);
      if (missionId === undefined) {
        this.emettreErreur(client, CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, "mission-absente");
        return;
      }
      try {
        const mission = await this.campagne.avancerSimulation(
          this.utilisateurId(client),
          missionId,
          demande.data.commandes,
          demande.data.jours,
        );
        if (mission.etatSimulation === null) {
          this.emettreErreur(client, CODES_CAMPAGNE.MISSION_NON_PRETE, "mission-non-lancee");
          return;
        }
        this.emettreProgression(client, mission.etatSimulation);
      } catch (erreur: unknown) {
        this.gererErreurAttendue(client, erreur);
      }
    });
  }

  @SubscribeMessage("simulation.decider")
  decider(@ConnectedSocket() client: Socket, @MessageBody() donnees: unknown): Promise<void> {
    if (!this.estAutorise(client)) return Promise.resolve();
    const demande = schemaDemandeDecision.safeParse(donnees);
    if (!demande.success) {
      this.emettreErreur(
        client,
        CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE,
        demande.error.issues.map((issue) => issue.path.join(".")).join(","),
      );
      return Promise.resolve();
    }
    return this.ordonner(client, async () => {
      const missionId = this.missions.get(client);
      if (missionId === undefined) {
        this.emettreErreur(client, CODES_SIMULATION.COMMANDE_SIMULATION_INVALIDE, "mission-absente");
        return;
      }
      try {
        const mission = await this.campagne.deciderCrise(
          this.utilisateurId(client),
          missionId,
          demande.data.choix,
          demande.data.cibleId,
        );
        if (mission.etatSimulation === null) {
          this.emettreErreur(client, CODES_CAMPAGNE.MISSION_NON_PRETE, "mission-non-lancee");
          return;
        }
        this.emettreProgression(client, mission.etatSimulation);
      } catch (erreur: unknown) {
        this.gererErreurAttendue(client, erreur);
      }
    });
  }

  private ordonner(client: Socket, operation: () => Promise<void>): Promise<void> {
    const precedente = this.files.get(client) ?? Promise.resolve();
    let liberer: () => void = () => undefined;
    const verrou = new Promise<void>((resolve) => {
      liberer = resolve;
    });
    const suivante = precedente.then(() => verrou);
    this.files.set(client, suivante);
    return precedente.then(async () => {
      try {
        await operation();
      } finally {
        liberer();
        if (this.files.get(client) === suivante) this.files.delete(client);
      }
    });
  }

  private utilisateurId(client: Socket): string {
    const utilisateurId: unknown = client.data.utilisateurId;
    if (typeof utilisateurId !== "string") {
      throw new UnauthorizedException();
    }
    return utilisateurId;
  }

  private estAutorise(client: Socket): boolean {
    if (this.clientsAutorises.has(client)) return true;
    client.disconnect(true);
    return false;
  }

  private emettreProgression(client: Socket, etat: string): void {
    client.emit("simulation.progression", this.simulation.progression(etat));
  }

  private gererErreurAttendue(client: Socket, erreur: unknown): void {
    if (erreur instanceof ErreurSimulation || erreur instanceof ErreurCampagne) {
      client.emit("simulation.erreur", erreur.explication);
      return;
    }
    throw erreur;
  }

  private emettreErreur(client: Socket, code: string, motif: string): void {
    client.emit("simulation.erreur", {
      version: 1,
      code,
      params: { motif },
    });
  }
}
