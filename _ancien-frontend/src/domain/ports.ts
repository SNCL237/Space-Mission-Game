import type { CampaignSummary, GameMode, RenderMode } from './campaign';

export class RepositoryError extends Error {
  constructor(message: string, readonly cause?: unknown) { super(message); }
}
/** Port vers la persistance / le backend. Le ViewModel ne connaît que cette interface. */
export interface CampaignRepository {
  /** Dernière sauvegarde exploitable, ou null s'il n'y en a pas. */
  getLatest(): Promise<CampaignSummary | null>;
  /** Crée une campagne (remplace la sauvegarde courante) avec le mode choisi. */
  create(mode: GameMode): Promise<CampaignSummary>;
}
export interface CapabilitiesProvider { detect(): RenderMode; }
export interface Navigator { go(route: string): void; }
