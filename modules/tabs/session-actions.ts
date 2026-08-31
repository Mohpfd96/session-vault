import { browser } from 'wxt/browser';
import { markSessionReady } from '../domain/lifecycle.ts';
import { asSessionId, type SessionId, type TabId } from '../domain/ids.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import {
  applySessionMarker,
  createSessionProfile,
  createTemporarySession,
} from '../domain/session-factory.ts';
import type { SessionKind } from '../domain/enums.ts';
import type { SessionProfile } from '../domain/session-profile.ts';
import { sessionNotFound } from '../errors/index.ts';
import { shouldDisposeTemporarySession } from '../domain/session-queries.ts';
import { logger } from '../logging/index.ts';
import {
  createBlankTab,
  removeTabs,
  updateTabUrl,
  waitForTabComplete,
} from '../adapters/chrome/tabs-adapter.ts';
import {
  createChromeStorageLocalPort,
  createIndexedDbPort,
  deleteSession,
  getSession,
  listSessions,
  replaceSessionCookies,
  upsertSession,
} from '../persistence/index.ts';
import { UNASSIGNED_SESSION_ID } from './constants.ts';
import type { TabBindingStore } from './binding-store.ts';
import type { TabCoordinator } from './coordinator.ts';
import {
  ensureManagedSite,
  injectIsolationScript,
  injectTabTitleMarker,
} from './ensure-managed-site.ts';

const localPort = createChromeStorageLocalPort();
const idb = createIndexedDbPort();

export type CreateSiteSessionInput = {
  readonly tabId: number;
  readonly name: string;
  readonly kind?: SessionKind;
  readonly color?: string;
  readonly icon?: string;
  readonly coordinator: TabCoordinator;
};

export type CreateSiteSessionResult = {
  readonly session: SessionProfile;
  readonly openedTabId: number;
  readonly boundCurrentTab: boolean;
};

export async function openUrlInBoundSession(input: {
  readonly url: string;
  readonly session: SessionProfile;
  readonly domainGroupId: DomainGroup['id'];
  readonly coordinator: TabCoordinator;
}): Promise<number> {
  const openedTabId = await createBlankTab();
  try {
    await input.coordinator.bindTabToSession(
      openedTabId,
      input.session,
      input.domainGroupId,
      'bound',
      input.url,
    );
  } catch (error) {
    logger.error('Failed to bind new session tab before navigate', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  try {
    await updateTabUrl(openedTabId, input.url);
    await waitForTabComplete(openedTabId, input.url);
    await injectIsolationScript(openedTabId);
    await injectTabTitleMarker(openedTabId, input.session.icon);
    input.coordinator.refreshTabAppearance(openedTabId);
    return openedTabId;
  } catch (error) {
    try {
      await browser.tabs.remove(openedTabId);
    } catch {
      // Tab may already be gone.
    }
    throw error;
  }
}

export async function createSiteSession(
  input: CreateSiteSessionInput,
): Promise<CreateSiteSessionResult> {
  const site = await ensureManagedSite(input.tabId);
  const existing = await listSessions(localPort);
  const kind: SessionKind = input.kind ?? 'persistent';

  let profile =
    kind === 'temporary'
      ? createTemporarySession(
          existing.map((session) => session.name),
          existing,
        )
      : createSessionProfile(
          {
            kind,
            existingNames: existing.map((session) => session.name),
            name: input.name,
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.icon !== undefined ? { icon: input.icon } : {}),
          },
          existing,
        );

  profile = {
    ...profile,
    name: applySessionMarker(profile.name, profile.icon),
    domainGroupIds: [site.group.id],
  };
  profile = markSessionReady(profile, new Date().toISOString());
  await upsertSession(localPort, profile);

  const openedTabId = await openUrlInBoundSession({
    url: site.url,
    session: profile,
    domainGroupId: site.group.id,
    coordinator: input.coordinator,
  });
  return { session: profile, openedTabId, boundCurrentTab: false };
}

export async function renameSiteSession(
  sessionId: string,
  name: string,
): Promise<SessionProfile> {
  const session = await getSession(localPort, asSessionId(sessionId));
  const updated: SessionProfile = {
    ...session,
    name: applySessionMarker(name, session.icon),
    updatedAt: new Date().toISOString(),
  };
  await upsertSession(localPort, updated);
  return updated;
}

export async function deleteSiteSession(
  sessionId: string,
  coordinator: TabCoordinator,
  bindingStore: TabBindingStore,
): Promise<void> {
  const id = asSessionId(sessionId);
  const sessions = await listSessions(localPort);
  const session = sessions.find((entry) => entry.id === id);
  if (session === undefined) {
    throw sessionNotFound(id);
  }

  const bindings = await bindingStore.getAll();
  const tabIds: TabId[] = [];
  for (const binding of bindings) {
    if (binding.sessionId !== id) {
      continue;
    }
    tabIds.push(binding.tabId);
    await coordinator.unbindTab(binding.tabId);
  }

  await removeTabs(tabIds);

  await replaceSessionCookies(idb, id, []);
  await deleteSession(localPort, id);
}

function boundTabCountForSession(
  bindings: readonly { readonly sessionId: SessionId }[],
  sessionId: SessionId,
): number {
  return bindings.filter((binding) => binding.sessionId === sessionId).length;
}

async function dropTemporarySession(sessionId: SessionId): Promise<void> {
  try {
    await replaceSessionCookies(idb, sessionId, []);
    await deleteSession(localPort, sessionId);
  } catch {
    // Session may already have been removed.
  }
}

export async function disposeTemporarySessionIfUnused(
  sessionId: SessionId,
  bindingStore: TabBindingStore,
): Promise<void> {
  if (sessionId === UNASSIGNED_SESSION_ID) {
    return;
  }

  const sessions = await listSessions(localPort);
  const session = sessions.find((entry) => entry.id === sessionId);
  const remaining = boundTabCountForSession(await bindingStore.getAll(), sessionId);
  if (!shouldDisposeTemporarySession(session, remaining)) {
    return;
  }

  await dropTemporarySession(sessionId);
}

export async function cleanupTemporarySessionsWithNoTabs(
  bindingStore: TabBindingStore,
): Promise<void> {
  const sessions = await listSessions(localPort);
  const bindings = await bindingStore.getAll();
  for (const session of sessions) {
    const remaining = boundTabCountForSession(bindings, session.id);
    if (shouldDisposeTemporarySession(session, remaining)) {
      await dropTemporarySession(session.id);
    }
  }
}

export async function reloadTabQuietly(tabId: number): Promise<void> {
  try {
    await browser.tabs.reload(tabId);
  } catch {
    // Tab may already be gone.
  }
}
