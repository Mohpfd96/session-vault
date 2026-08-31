import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import {
  onTabActivated,
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onWindowFocusChanged,
  queryActiveTabId,
} from '../../modules/adapters/chrome/tabs-adapter.ts';
import {
  syncToolbarIconForTab,
  syncToolbarIconsForOpenTabs,
} from '../../modules/tabs/sync-toolbar-icon.ts';
import { shouldSyncToolbarIconOnTabUpdate } from '../../modules/tabs/action-icon.ts';
import { subscribeOnHeadersReceived } from '../../modules/adapters/chrome/web-request-adapter.ts';
import { isolationUncertain } from '../../modules/errors/index.ts';
import { loadDomainGroups } from '../../modules/domains/load-groups.ts';
import { syncIsolationContentScripts } from '../../modules/domains/sync-content-scripts.ts';
import { createChromeRuleIdAllocatorStore } from '../../modules/isolation/rule-store.ts';
import {
  cleanupUnknownSessionRules,
  createVirtualExtensionIsolationProvider,
} from '../../modules/isolation/virtual-extension-provider.ts';
import { logger } from '../../modules/logging/index.ts';
import { createBackgroundRouter } from '../../modules/messaging/background-router.ts';
import {
  createChromeStorageLocalPort,
  createChromeStorageSessionPort,
  createIndexedDbPort,
  initializePersistence,
  listCookiesForSession,
  listSessions,
  readSchemaMeta,
  replaceSessionCookies,
} from '../../modules/persistence/index.ts';
import type { SessionProfile } from '../../modules/domain/session-profile.ts';
import { asTabId, type SessionId, type TabId } from '../../modules/domain/ids.ts';
import { createSessionTabBindingStore } from '../../modules/tabs/binding-store.ts';
import { createTabCoordinator } from '../../modules/tabs/coordinator.ts';
import {
  cleanupTemporarySessionsWithNoTabs,
  disposeTemporarySessionIfUnused,
} from '../../modules/tabs/session-actions.ts';
import { injectTabTitleMarker } from '../../modules/tabs/ensure-managed-site.ts';
import { isAssignedSessionBinding } from '../../modules/tabs/binding-state.ts';
import {
  collectSetCookieHeaders,
  createCookieJar,
  ingestSetCookieLines,
  upsertCookie,
} from '../../modules/cookies/index.ts';
import type { HeadersReceivedDetails } from '../../modules/adapters/chrome/web-request-adapter.ts';

const localPort = createChromeStorageLocalPort();
const sessionPort = createChromeStorageSessionPort();
const idb = createIndexedDbPort();
const bindingStore = createSessionTabBindingStore(sessionPort);
const ruleStore = createChromeRuleIdAllocatorStore(sessionPort);
const isolation = createVirtualExtensionIsolationProvider({
  ruleStore,
  cookies: {
    getCookiesForSession: (sessionId) => listCookiesForSession(idb, sessionId),
  },
});

const coordinator = createTabCoordinator({
  bindingStore,
  isolation,
  loadDomainGroups: () => loadDomainGroups(localPort),
  getSession: async (sessionId: SessionId): Promise<SessionProfile | undefined> => {
    const sessions = await listSessions(localPort);
    return sessions.find((session) => session.id === sessionId);
  },
  onBindingChanged: (tabId) => {
    void syncToolbarIconForTab(tabId, bindingStore);
  },
});

const router = createBackgroundRouter({
  bindingStore,
  coordinator,
  isolation,
});

let resolveReady: (() => void) | undefined;
const ready = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

function afterReady(task: () => void | Promise<void>): void {
  void ready.then(() => {
    void task();
  });
}

function syncIcon(tabId: TabId): void {
  afterReady(() => syncToolbarIconForTab(tabId, bindingStore));
}

async function injectTitleForTab(tabId: TabId): Promise<void> {
  const binding = await bindingStore.get(tabId);
  if (binding === undefined || !isAssignedSessionBinding(binding)) {
    return;
  }
  const sessions = await listSessions(localPort);
  const session = sessions.find((entry) => entry.id === binding.sessionId);
  if (session === undefined) {
    return;
  }
  await injectTabTitleMarker(tabId, session.icon);
}

async function ingestHttpSetCookies(details: HeadersReceivedDetails): Promise<void> {
  if (details.tabId < 0) {
    return;
  }
  const lines = collectSetCookieHeaders(details.responseHeaders);
  if (lines.length === 0) {
    return;
  }
  const tabId = asTabId(details.tabId);
  const binding = await bindingStore.get(tabId);
  if (binding === undefined || !isAssignedSessionBinding(binding)) {
    return;
  }
  let requestUrl: URL;
  try {
    requestUrl = new URL(details.url);
  } catch {
    return;
  }
  const existing = await listCookiesForSession(idb, binding.sessionId);
  let jar = createCookieJar();
  for (const cookie of existing) {
    jar = upsertCookie(jar, cookie);
  }
  const next = ingestSetCookieLines(jar, lines, {
    sessionId: binding.sessionId,
    requestUrl,
    now: Date.now(),
    source: 'http',
  });
  await replaceSessionCookies(idb, binding.sessionId, [...next.values()]);
  const sessions = await listSessions(localPort);
  const session = sessions.find((entry) => entry.id === binding.sessionId);
  if (session !== undefined) {
    await coordinator.bindTabToSession(
      tabId,
      session,
      binding.domainGroupId,
      'bound',
      details.url,
    );
  }
}

async function bootstrap(): Promise<void> {
  try {
    await initializePersistence({
      local: localPort,
      session: sessionPort,
      idb,
    });

    const schema = await readSchemaMeta(localPort);
    if (schema === undefined) {
      logger.info('Persistence schema not initialized yet');
    }

    await syncIsolationContentScripts(await loadDomainGroups(localPort));

    await coordinator.reconcileOpenTabs();
    await cleanupUnknownSessionRules(ruleStore);
    await cleanupTemporarySessionsWithNoTabs(bindingStore);
    logger.info('Background initialized');
  } catch (error) {
    logger.error('Background init failed; fail-closed mode', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw isolationUncertain('Background initialization did not complete.');
  } finally {
    resolveReady?.();
    await syncToolbarIconsForOpenTabs(bindingStore);
  }
}

export default defineBackground(() => {
  onTabRemoved((tabId) => {
    afterReady(async () => {
      const sessionId = await coordinator.handleTabRemoved(tabId);
      if (sessionId !== undefined) {
        await disposeTemporarySessionIfUnused(sessionId, bindingStore);
      }
      await cleanupTemporarySessionsWithNoTabs(bindingStore);
    });
  });

  onTabCreated((tab) => {
    afterReady(() =>
      coordinator.handleTabCreated({
        id: tab.id,
        openerTabId: tab.openerTabId,
        url: tab.url,
        ...(tab.pendingUrl !== undefined ? { pendingUrl: tab.pendingUrl } : {}),
      }),
    );
    syncIcon(tab.id);
  });

  onTabActivated((tabId) => {
    syncIcon(tabId);
  });

  onTabUpdated((tabId, changeInfo) => {
    if (shouldSyncToolbarIconOnTabUpdate(changeInfo)) {
      syncIcon(tabId);
    }
  });

  onWindowFocusChanged((windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      return;
    }
    afterReady(async () => {
      const tabId = await queryActiveTabId(windowId);
      if (tabId !== undefined) {
        await syncToolbarIconForTab(tabId, bindingStore);
      }
    });
  });

  const syncAfterNavigation = (details: {
    frameId: number;
    tabId: number;
    url: string;
  }): void => {
    if (details.frameId !== 0 || details.tabId < 0) {
      return;
    }
    const tabId = asTabId(details.tabId);
    afterReady(async () => {
      try {
        await coordinator.handleNavigationCommitted(tabId, details.url);
        await injectTitleForTab(tabId);
      } finally {
        await syncToolbarIconForTab(tabId, bindingStore);
      }
    });
  };
  browser.webNavigation.onCommitted.addListener(syncAfterNavigation);
  browser.webNavigation.onCompleted.addListener(syncAfterNavigation);

  subscribeOnHeadersReceived((details) => {
    afterReady(() => ingestHttpSetCookies(details));
  });

  void bootstrap();

  browser.runtime.onMessage.addListener((message, sender) => {
    const tab =
      sender.tab === undefined
        ? undefined
        : {
            ...(sender.tab.id !== undefined ? { id: sender.tab.id } : {}),
            ...(sender.tab.url !== undefined ? { url: sender.tab.url } : {}),
          };
    return router.handleMessage(message, tab === undefined ? {} : { tab });
  });

  browser.commands.onCommand.addListener((command) => {
    afterReady(() => router.handleCommand(command));
  });

  try {
    browser.contextMenus.create({
      id: 'sv-open-side-panel',
      title: 'Open side panel',
      contexts: ['action'],
    });
  } catch {
    // Menu already exists after service worker restart.
  }

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'sv-open-side-panel' && tab?.id !== undefined) {
      void router.handleMessage({ type: 'ui.openSidePanel' }, { tab: { id: tab.id } });
    }
  });
});
