import { browser } from 'wxt/browser';
import type { TabId } from '../../domain/ids.ts';

export type TabInfo = {
  readonly id: TabId;
  readonly url: string | undefined;
  readonly pendingUrl: string | undefined;
  readonly openerTabId: TabId | undefined;
};

type CreatedTab = Parameters<Parameters<typeof browser.tabs.onCreated.addListener>[0]>[0];

function mapTab(tab: {
  id: number;
  url?: string;
  pendingUrl?: string;
  openerTabId?: number;
}): TabInfo {
  return {
    id: tab.id as TabId,
    url: tab.url,
    pendingUrl: tab.pendingUrl,
    openerTabId: tab.openerTabId !== undefined ? (tab.openerTabId as TabId) : undefined,
  };
}

export async function queryTabs(
  query: Record<string, unknown> = {},
): Promise<readonly TabInfo[]> {
  const tabs = await browser.tabs.query(query);
  const result: TabInfo[] = [];
  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }
    const mapped = mapTab({
      id: tab.id,
      ...(tab.url !== undefined ? { url: tab.url } : {}),
      ...(tab.pendingUrl !== undefined ? { pendingUrl: tab.pendingUrl } : {}),
      ...(tab.openerTabId !== undefined ? { openerTabId: tab.openerTabId } : {}),
    });
    result.push(mapped);
  }
  return result;
}

export async function getTab(tabId: TabId): Promise<TabInfo | undefined> {
  try {
    const tab = await browser.tabs.get(tabId);
    if (tab.id === undefined) {
      return undefined;
    }
    return mapTab({
      id: tab.id,
      ...(tab.url !== undefined ? { url: tab.url } : {}),
      ...(tab.pendingUrl !== undefined ? { pendingUrl: tab.pendingUrl } : {}),
      ...(tab.openerTabId !== undefined ? { openerTabId: tab.openerTabId } : {}),
    });
  } catch {
    return undefined;
  }
}

export async function createBlankTab(): Promise<TabId> {
  const tab = await browser.tabs.create({ url: 'about:blank', active: true });
  if (tab.id === undefined) {
    throw new Error('Failed to create tab: missing tab id.');
  }
  return tab.id as TabId;
}

export async function updateTabUrl(tabId: TabId, url: string): Promise<void> {
  await browser.tabs.update(tabId, { url });
}

function tabMatchesDestination(
  tabUrl: string | undefined,
  destinationUrl: string,
): boolean {
  if (
    tabUrl === undefined ||
    tabUrl === 'about:blank' ||
    tabUrl.startsWith('chrome://')
  ) {
    return false;
  }
  try {
    return new URL(tabUrl).origin === new URL(destinationUrl).origin;
  } catch {
    return tabUrl.startsWith(destinationUrl) || destinationUrl.startsWith(tabUrl);
  }
}

export async function waitForTabComplete(
  tabId: TabId,
  destinationUrl: string,
  timeoutMs = 15_000,
): Promise<void> {
  const isReady = async (): Promise<boolean> => {
    try {
      const tab = await browser.tabs.get(tabId);
      return tab.status === 'complete' && tabMatchesDestination(tab.url, destinationUrl);
    } catch {
      return false;
    }
  };

  if (await isReady()) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const timer = globalThis.setTimeout(finish, timeoutMs);
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string | undefined },
      tab: { url?: string | undefined },
    ): void => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }
      if (tabMatchesDestination(tab.url, destinationUrl)) {
        finish();
      }
    };
    browser.tabs.onUpdated.addListener(listener);
    void isReady().then((ready) => {
      if (ready) {
        finish();
      }
    });
  });
}

export function onTabRemoved(listener: (tabId: TabId) => void): () => void {
  const handler = (tabId: number): void => {
    listener(tabId as TabId);
  };
  browser.tabs.onRemoved.addListener(handler);
  return () => {
    browser.tabs.onRemoved.removeListener(handler);
  };
}

export function onTabActivated(listener: (tabId: TabId) => void): () => void {
  const handler = (info: { tabId: number }): void => {
    listener(info.tabId as TabId);
  };
  browser.tabs.onActivated.addListener(handler);
  return () => {
    browser.tabs.onActivated.removeListener(handler);
  };
}

export function onTabUpdated(
  listener: (
    tabId: TabId,
    changeInfo: { status?: string | undefined; url?: string | undefined },
  ) => void,
): () => void {
  const handler = (
    tabId: number,
    changeInfo: { status?: string | undefined; url?: string | undefined },
  ): void => {
    listener(tabId as TabId, changeInfo);
  };
  browser.tabs.onUpdated.addListener(handler);
  return () => {
    browser.tabs.onUpdated.removeListener(handler);
  };
}

export function onWindowFocusChanged(listener: (windowId: number) => void): () => void {
  const handler = (windowId: number): void => {
    listener(windowId);
  };
  browser.windows.onFocusChanged.addListener(handler);
  return () => {
    browser.windows.onFocusChanged.removeListener(handler);
  };
}

export async function queryActiveTabId(windowId?: number): Promise<TabId | undefined> {
  const tabs =
    windowId === undefined
      ? await browser.tabs.query({ active: true, lastFocusedWindow: true })
      : await browser.tabs.query({ active: true, windowId });
  const id = tabs[0]?.id;
  return id === undefined ? undefined : (id as TabId);
}

export function onTabCreated(listener: (tab: TabInfo) => void): () => void {
  const handler: (tab: CreatedTab) => void = (tab) => {
    if (tab.id === undefined) {
      return;
    }
    listener(
      mapTab({
        id: tab.id,
        ...(tab.url !== undefined ? { url: tab.url } : {}),
        ...(tab.pendingUrl !== undefined ? { pendingUrl: tab.pendingUrl } : {}),
        ...(tab.openerTabId !== undefined ? { openerTabId: tab.openerTabId } : {}),
      }),
    );
  };
  browser.tabs.onCreated.addListener(handler);
  return () => {
    browser.tabs.onCreated.removeListener(handler);
  };
}
