import { browser } from 'wxt/browser';
import type { TabId } from '../../domain/ids.ts';

export async function openSidePanel(tabId: TabId): Promise<void> {
  const sidePanel = browser.sidePanel;
  if (typeof sidePanel.open === 'function') {
    await sidePanel.open({ tabId });
    return;
  }
  await sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
  await sidePanel.open({ tabId });
}
