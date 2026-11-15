import { BrowserCapabilities } from '../data/BrowserCapabilities';
import { HashNavigator } from '../data/HashNavigator';
import { HttpCampaignRepository } from '../data/HttpCampaignRepository';
import { LocalCampaignRepository } from '../data/LocalCampaignRepository';
import type { CampaignRepository } from '../domain/ports';
import { MenuViewModel } from '../features/menu/MenuViewModel';
import { ModeSelectionViewModel } from '../features/mode/ModeSelectionViewModel';

/** Seul endroit qui choisit les implémentations : brancher le backend = changer ici (ou via .env). */
export function createContainer() {
  const env = import.meta.env;
  const useHttp = !!env.VITE_API_URL && env.VITE_USE_MOCK !== '1';
  const campaigns: CampaignRepository = useHttp
    ? new HttpCampaignRepository(env.VITE_API_URL as string)
    : new LocalCampaignRepository(env.VITE_MOCK_SEED === '1' ? { id: 'demo-1', currentAct: 3, mode: 'guided', updatedAt: new Date() } : undefined);
  const nav = new HashNavigator();
  const caps = new BrowserCapabilities();
  return {
    createMenuViewModel: () => new MenuViewModel(campaigns, caps, nav),
    createModeViewModel: () => new ModeSelectionViewModel(campaigns, nav),
  };
}
