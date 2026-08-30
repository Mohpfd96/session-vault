import type { TabId } from '../domain/ids.ts';
import { setToolbarIcon } from '../adapters/chrome/action-adapter.ts';
import { queryTabs } from '../adapters/chrome/tabs-adapter.ts';
import { isToolbarIconFilled } from './action-icon.ts';
import type { TabBindingStore } from './binding-store.ts';

export async function syncToolbarIconForTab(
  tabId: TabId,
  bindingStore: TabBindingStore,
): Promise<void> {
  try {
    const binding = await bindingStore.get(tabId);
    await setToolbarIcon(tabId, isToolbarIconFilled(binding) ? 'active' : 'idle');
  } catch {
    await setToolbarIcon(tabId, 'idle');
  }
}

export async function syncToolbarIconsForOpenTabs(
  bindingStore: TabBindingStore,
): Promise<void> {
  const tabs = await queryTabs();
  for (const tab of tabs) {
    await syncToolbarIconForTab(tab.id, bindingStore);
  }
}
