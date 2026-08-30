import { browser } from 'wxt/browser';

export type ActiveBrowserTab = {
  readonly id: number;
  readonly url?: string;
  readonly title?: string;
};

function isExtensionPage(url: string): boolean {
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('edge-extension://')
  );
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

type BrowserTab = {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
  readonly title?: string | undefined;
};

function toActiveTab(tab: BrowserTab): ActiveBrowserTab | undefined {
  const id = tab.id;
  if (id === undefined) {
    return undefined;
  }
  const url = tab.url;
  const title = tab.title;
  if (url !== undefined && isExtensionPage(url)) {
    return undefined;
  }
  return {
    id,
    ...(url !== undefined ? { url } : {}),
    ...(title !== undefined ? { title } : {}),
  };
}

function pickFromQuery(tabs: readonly BrowserTab[]): ActiveBrowserTab[] {
  const result: ActiveBrowserTab[] = [];
  for (const tab of tabs) {
    const mapped = toActiveTab(tab);
    if (mapped !== undefined) {
      result.push(mapped);
    }
  }
  return result;
}

/**
 * Popup and side panel messages have no sender.tab. Resolve the page the user
 * was looking at (skip the extension UI itself).
 */
export async function resolveActiveBrowserTab(): Promise<ActiveBrowserTab | undefined> {
  const querySets: ReadonlyArray<Record<string, boolean>> = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ];

  for (const query of querySets) {
    const mapped = pickFromQuery(
      (await browser.tabs.query(query)) as readonly BrowserTab[],
    );
    const httpTab = mapped.find((tab) => tab !== undefined && isIsolatableUrl(tab.url));
    if (httpTab !== undefined) {
      return httpTab;
    }
    const anyTab = mapped.find((tab) => tab !== undefined);
    if (anyTab !== undefined) {
      return anyTab;
    }
  }

  const mappedAll = pickFromQuery(
    (await browser.tabs.query({ active: true })) as readonly BrowserTab[],
  );
  const httpFallback = mappedAll.find(
    (tab) => tab !== undefined && isIsolatableUrl(tab.url),
  );
  if (httpFallback !== undefined) {
    return httpFallback;
  }

  return mappedAll.find((tab) => tab !== undefined);
}

export function displaySiteLabel(url: string | undefined): string {
  if (url === undefined || url.length === 0) {
    return 'No website tab';
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    ) {
      return parsed.hostname.length > 0 ? parsed.hostname : 'No website tab';
    }
    return 'Browser page';
  } catch {
    return 'No website tab';
  }
}

export function isIsolatableUrl(url: string | undefined): boolean {
  return url !== undefined && isHttpUrl(url);
}

export async function resolveUiTabId(
  senderTabId: number | undefined,
): Promise<number | undefined> {
  if (senderTabId !== undefined) {
    try {
      const tab = await browser.tabs.get(senderTabId);
      if (tab.url === undefined || !isExtensionPage(tab.url)) {
        return senderTabId;
      }
    } catch {
      return senderTabId;
    }
  }
  const active = await resolveActiveBrowserTab();
  return active?.id;
}
