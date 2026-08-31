import { browser } from 'wxt/browser';
import { asOrigin, asSessionId, asTabId, type SessionId } from '../domain/ids.ts';
import { markSessionReady } from '../domain/lifecycle.ts';
import { createSessionProfile } from '../domain/session-factory.ts';
import { DomainError } from '../errors/domain-error.ts';
import { sessionNotFound } from '../errors/index.ts';
import { loadDomainGroups } from '../domains/load-groups.ts';
import {
  findManagedDomainGroup,
  hostFromUrl,
  matchesDomainGroup,
  registrableDomain,
} from '../domains/matcher.ts';
import type { IsolationProvider } from '../isolation/provider.ts';
import { logger } from '../logging/index.ts';
import {
  createChromeStorageLocalPort,
  createIndexedDbPort,
  listCookiesForSession,
  listSessions,
  replaceSessionCookies,
  upsertSession,
} from '../persistence/index.ts';
import type { TabCoordinator } from '../tabs/coordinator.ts';
import type { TabBindingStore } from '../tabs/binding-store.ts';
import { UNASSIGNED_SESSION_ID } from '../tabs/constants.ts';
import { filterSessionsForSite, homeUrlForDomainGroup } from '../sessions/site-filter.ts';
import { displaySiteLabel, isIsolatableUrl, resolveUiTabId } from '../tabs/active-tab.ts';
import { enableIsolationForActiveTab } from '../tabs/enable-isolation.ts';
import { nextCycledId } from '../domain/session-queries.ts';
import {
  createSiteSession,
  deleteSiteSession,
  openUrlInBoundSession,
  reloadTabQuietly,
  renameSiteSession,
} from '../tabs/session-actions.ts';
import {
  applyParsedSetCookie,
  createCookieJar,
  documentCookieString,
  parseSetCookie,
  upsertCookie,
} from '../cookies/index.ts';
import type { ContentRequest, Result, UiRequest } from './protocol.ts';
import {
  domainErrorToResult,
  successResult,
  type ContentHelloResponse,
} from './background-types.ts';
import { parseContentRequest, parseUiRequest } from './validate.ts';
import {
  compatibilityInfo,
  toSessionListItems,
  type IsolationChipStatus,
  type PopupSnapshot,
  type SidePanelSnapshot,
} from './snapshots.ts';

const localPort = createChromeStorageLocalPort();
const idb = createIndexedDbPort();

function isolationStatusFromBinding(
  binding: Awaited<ReturnType<TabBindingStore['get']>>,
  managed: boolean,
): IsolationChipStatus {
  if (binding === undefined) {
    return managed ? 'unassigned' : 'off';
  }
  switch (binding.assignmentState) {
    case 'bound':
      return 'isolated';
    case 'unassigned':
    case 'pending':
    case 'locked':
      return 'unassigned';
    case 'degraded':
      return 'degraded';
    default: {
      const exhaustive: never = binding.assignmentState;
      return exhaustive;
    }
  }
}

function tabCountsFromBindings(
  bindings: readonly { sessionId: SessionId }[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const binding of bindings) {
    if (binding.sessionId === UNASSIGNED_SESSION_ID) {
      continue;
    }
    const key = binding.sessionId;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type RouterContext = {
  readonly bindingStore: TabBindingStore;
  readonly coordinator: TabCoordinator;
  readonly isolation: IsolationProvider;
};

export function createBackgroundRouter(ctx: RouterContext) {
  const { bindingStore, coordinator, isolation } = ctx;

  async function readTabSite(tabId: number | undefined): Promise<{
    origin: string;
    hostname: string;
    siteLabel: string;
    favIconUrl: string | null;
    tabUrl: string | undefined;
    host: string | undefined;
    managed: boolean;
    domainGroupId: string | null;
  }> {
    let origin = '';
    let hostname = 'No website tab';
    let siteLabel = 'No website tab';
    let favIconUrl: string | null = null;
    let tabUrl: string | undefined;
    let host: string | undefined;

    if (tabId !== undefined) {
      try {
        const tab = await browser.tabs.get(tabId);
        tabUrl = tab.url;
        hostname = displaySiteLabel(tab.url);
        if (tab.favIconUrl !== undefined && tab.favIconUrl.length > 0) {
          favIconUrl = tab.favIconUrl;
        }
        if (tab.url !== undefined && isIsolatableUrl(tab.url)) {
          origin = new URL(tab.url).origin;
          host = hostFromUrl(tab.url);
          siteLabel = host !== undefined ? registrableDomain(host) : hostname;
        }
      } catch {
        tabUrl = undefined;
      }
    }

    const groups = await loadDomainGroups(localPort);
    const managedGroup =
      host !== undefined && tabUrl !== undefined
        ? findManagedDomainGroup(host, tabUrl, groups)
        : undefined;

    return {
      origin,
      hostname,
      siteLabel,
      favIconUrl,
      tabUrl,
      host,
      managed: managedGroup !== undefined,
      domainGroupId: managedGroup?.id ?? null,
    };
  }

  async function getPopupSnapshot(tabId: number | undefined): Promise<PopupSnapshot> {
    const site = await readTabSite(tabId);
    const binding =
      tabId !== undefined ? await bindingStore.get(asTabId(tabId)) : undefined;
    const sessions = await listSessions(localPort);
    const groups = await loadDomainGroups(localPort);
    const bindings = await bindingStore.getAll();
    const siteSessions = filterSessionsForSite(sessions, groups, site.host, site.tabUrl);
    const sessionItems = toSessionListItems(
      siteSessions,
      tabCountsFromBindings(bindings),
    );

    const currentSessionId =
      binding !== undefined && binding.sessionId !== UNASSIGNED_SESSION_ID
        ? binding.sessionId
        : null;

    const compatibility = await isolation.getCompatibility(
      site.origin.length > 0 ? asOrigin(site.origin) : asOrigin('null://null'),
    );

    return {
      hostname: site.hostname,
      siteLabel: site.siteLabel,
      origin: site.origin,
      favIconUrl: site.favIconUrl,
      isolationStatus: isolationStatusFromBinding(binding, site.managed),
      isolationEnabled: site.managed,
      currentSessionId,
      currentDomainGroupId: site.domainGroupId,
      canIsolate: site.origin.length > 0,
      sessions: sessionItems,
      compatibility: compatibilityInfo(compatibility.level, compatibility.reasons),
    };
  }

  async function getSidePanelSnapshot(
    tabId: number | undefined,
  ): Promise<SidePanelSnapshot> {
    const site = await readTabSite(tabId);
    const sessions = await listSessions(localPort);
    const groups = await loadDomainGroups(localPort);
    const bindings = await bindingStore.getAll();
    const binding =
      tabId !== undefined ? await bindingStore.get(asTabId(tabId)) : undefined;
    const active = new Set<SessionId>();
    for (const entry of bindings) {
      if (entry.assignmentState === 'bound') {
        active.add(entry.sessionId);
      }
    }
    const currentSessionId =
      binding !== undefined && binding.sessionId !== UNASSIGNED_SESSION_ID
        ? binding.sessionId
        : null;

    return {
      hostname: site.hostname,
      origin: site.origin,
      isolationStatus: isolationStatusFromBinding(binding, site.managed),
      isolationEnabled: site.managed,
      currentSessionId,
      currentDomainGroupId: site.domainGroupId,
      canIsolate: site.origin.length > 0,
      sessions: toSessionListItems(sessions, tabCountsFromBindings(bindings)),
      domains: groups,
      activeSessionIds: [...active],
    };
  }

  function requireTabId(tabId: number | undefined, action: string): number {
    if (tabId === undefined) {
      throw new DomainError(
        'TabNotBound',
        `No website tab for ${action}.`,
        true,
        'Click a tab like google.com, then try again.',
      );
    }
    return tabId;
  }

  async function createPersistentSession(input: {
    name: string;
    color?: string;
    icon?: string;
  }) {
    const existing = await listSessions(localPort);
    const names = existing.map((session) => session.name);
    let profile = createSessionProfile(
      {
        kind: 'persistent',
        existingNames: names,
        name: input.name,
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      },
      existing,
    );
    profile = markSessionReady(profile, new Date().toISOString());
    await upsertSession(localPort, profile);
    return profile;
  }

  async function switchTabSession(tabId: number, sessionId: string) {
    const sessions = await listSessions(localPort);
    const session = sessions.find((entry) => entry.id === sessionId);
    if (session === undefined) {
      throw sessionNotFound(asSessionId(sessionId));
    }

    const tab = await browser.tabs.get(tabId);
    const url = tab.url;
    if (url === undefined) {
      throw new DomainError(
        'TabNotBound',
        'Cannot switch session on a tab without a URL.',
        true,
        'Navigate the tab to a site first.',
      );
    }

    const host = hostFromUrl(url);
    if (host === undefined) {
      throw new DomainError(
        'DomainNotManaged',
        'Cannot resolve hostname for this tab.',
        true,
        'Navigate to a supported site.',
      );
    }

    const groups = await loadDomainGroups(localPort);
    const managed = findManagedDomainGroup(host, url, groups);
    if (managed === undefined) {
      throw new DomainError(
        'DomainNotManaged',
        `${host} is not managed.`,
        true,
        'Enable isolation for this site first.',
      );
    }

    const binding = await coordinator.bindTabToSession(
      asTabId(tabId),
      session,
      managed.id,
      'bound',
    );
    await reloadTabQuietly(tabId);
    return binding;
  }

  async function openSessionInNewTab(
    sessionId: string,
    preferredTabId: number | undefined,
  ): Promise<{ tabId: number }> {
    const sessions = await listSessions(localPort);
    const session = sessions.find((entry) => entry.id === sessionId);
    if (session === undefined) {
      throw sessionNotFound(asSessionId(sessionId));
    }

    const groups = await loadDomainGroups(localPort);
    const group = groups.find((entry) => session.domainGroupIds.includes(entry.id));
    if (group === undefined) {
      throw new DomainError(
        'DomainNotManaged',
        'This session is not linked to a site.',
        true,
        'Create the session from the site popup first.',
      );
    }

    let url: string | undefined;
    if (preferredTabId !== undefined) {
      try {
        const tab = await browser.tabs.get(preferredTabId);
        if (tab.url !== undefined && isIsolatableUrl(tab.url)) {
          const host = hostFromUrl(tab.url);
          if (host !== undefined && matchesDomainGroup(host, tab.url, group)) {
            url = tab.url;
          }
        }
      } catch {
        url = undefined;
      }
    }

    if (url === undefined) {
      url = homeUrlForDomainGroup(group);
    }
    if (url === undefined) {
      throw new DomainError(
        'DomainNotManaged',
        'Cannot determine a URL for this session.',
        true,
        'Open the site in a tab, then try again.',
      );
    }

    const newTabId = await openUrlInBoundSession({
      url,
      session,
      domainGroupId: group.id,
      coordinator,
    });
    return { tabId: newTabId };
  }

  async function handleContentHello(
    tabId: number,
    origin: string,
  ): Promise<ContentHelloResponse> {
    const binding = await bindingStore.get(asTabId(tabId));
    if (binding === undefined) {
      const groups = await loadDomainGroups(localPort);
      const host = hostFromUrl(origin);
      if (host === undefined) {
        return { managed: false, assignmentState: 'none' };
      }
      const managed = findManagedDomainGroup(host, origin, groups);
      return {
        managed: managed !== undefined,
        assignmentState: 'none',
      };
    }

    if (binding.sessionId === UNASSIGNED_SESSION_ID) {
      return {
        managed: true,
        assignmentState: binding.assignmentState,
      };
    }

    if (binding.assignmentState === 'bound' || binding.assignmentState === 'degraded') {
      const sessions = await listSessions(localPort);
      const session = sessions.find((entry) => entry.id === binding.sessionId);
      if (session !== undefined) {
        return {
          managed: true,
          assignmentState: binding.assignmentState,
          tabMarker: session.icon,
        };
      }
    }

    return {
      managed: true,
      assignmentState: binding.assignmentState,
    };
  }

  async function handleDocumentCookieGet(tabId: number, href: string): Promise<string> {
    const binding = await bindingStore.get(asTabId(tabId));
    if (binding === undefined || binding.sessionId === UNASSIGNED_SESSION_ID) {
      return '';
    }
    const cookies = await listCookiesForSession(idb, binding.sessionId);
    try {
      return documentCookieString(cookies, new URL(href), Date.now());
    } catch {
      return '';
    }
  }

  async function handleDocumentCookieSet(
    tabId: number,
    href: string,
    assignment: string,
  ): Promise<void> {
    const binding = await bindingStore.get(asTabId(tabId));
    if (binding === undefined || binding.sessionId === UNASSIGNED_SESSION_ID) {
      return;
    }
    let requestUrl: URL;
    try {
      requestUrl = new URL(href);
    } catch {
      return;
    }
    const parsed = parseSetCookie(assignment, requestUrl, Date.now());
    if (parsed === null) {
      return;
    }
    const existing = await listCookiesForSession(idb, binding.sessionId);
    let jar = createCookieJar();
    for (const cookie of existing) {
      jar = upsertCookie(jar, cookie);
    }
    const next = applyParsedSetCookie(jar, parsed, {
      sessionId: binding.sessionId,
      source: 'document',
      now: Date.now(),
    });
    await replaceSessionCookies(idb, binding.sessionId, [...next.values()]);
    const sessions = await listSessions(localPort);
    const session = sessions.find((entry) => entry.id === binding.sessionId);
    if (session !== undefined) {
      await coordinator.bindTabToSession(
        asTabId(tabId),
        session,
        binding.domainGroupId,
        'bound',
      );
    }
  }

  async function handleUiRequest(
    request: UiRequest,
    senderTabId: number | undefined,
  ): Promise<Result<unknown>> {
    try {
      switch (request.type) {
        case 'ui.ping':
          return successResult({ pong: true as const });
        case 'ui.listSessions':
          return successResult({ sessions: await listSessions(localPort) });
        case 'ui.getPopupSnapshot':
          return successResult(await getPopupSnapshot(senderTabId));
        case 'ui.getSidePanelSnapshot':
          return successResult(await getSidePanelSnapshot(senderTabId));
        case 'ui.createSession': {
          const attach = request.attachToActiveTab !== false;
          if (attach) {
            const tabId = requireTabId(senderTabId, 'creating a session');
            return successResult(
              await createSiteSession({
                tabId,
                name: request.name,
                coordinator,
                ...(request.kind !== undefined ? { kind: request.kind } : {}),
                ...(request.color !== undefined ? { color: request.color } : {}),
                ...(request.icon !== undefined ? { icon: request.icon } : {}),
              }),
            );
          }
          return successResult({
            session: await createPersistentSession({
              name: request.name,
              ...(request.color !== undefined ? { color: request.color } : {}),
              ...(request.icon !== undefined ? { icon: request.icon } : {}),
            }),
          });
        }
        case 'ui.createTemporarySession': {
          const tabId = requireTabId(senderTabId, 'creating a temporary session');
          return successResult(
            await createSiteSession({
              tabId,
              name: 'Temp',
              kind: 'temporary',
              coordinator,
            }),
          );
        }
        case 'ui.switchTabSession': {
          const tabId = requireTabId(senderTabId, 'switching session');
          return successResult({
            binding: await switchTabSession(tabId, request.sessionId),
          });
        }
        case 'ui.openSidePanel': {
          const tabId = requireTabId(senderTabId, 'opening the side panel');
          const { openSidePanel } =
            await import('../adapters/chrome/sidepanel-adapter.ts');
          await openSidePanel(asTabId(tabId));
          return successResult({ opened: true as const });
        }
        case 'ui.duplicateIntoSession': {
          const tabId = requireTabId(senderTabId, 'opening this page');
          const tab = await browser.tabs.get(tabId);
          if (tab.url === undefined) {
            throw new DomainError(
              'TabNotBound',
              'The current tab has no URL.',
              true,
              'Navigate to a site first.',
            );
          }
          const sessions = await listSessions(localPort);
          const session = sessions.find((entry) => entry.id === request.sessionId);
          if (session === undefined) {
            throw sessionNotFound(asSessionId(request.sessionId));
          }
          const groups = await loadDomainGroups(localPort);
          const host = hostFromUrl(tab.url);
          const group =
            host !== undefined
              ? findManagedDomainGroup(host, tab.url, groups)
              : undefined;
          if (group === undefined) {
            throw new DomainError(
              'DomainNotManaged',
              'Create a session for this site first.',
              true,
              'Use New session, then open in that session.',
            );
          }
          const newTabId = await openUrlInBoundSession({
            url: tab.url,
            session,
            domainGroupId: group.id,
            coordinator,
          });
          return successResult({ tabId: newTabId });
        }
        case 'ui.moveTabToSession': {
          const tabId = requireTabId(senderTabId, 'moving this tab');
          return successResult({
            binding: await switchTabSession(tabId, request.sessionId),
          });
        }
        case 'ui.enableIsolationForTab': {
          const tabId = requireTabId(senderTabId, 'isolating this site');
          return successResult(await enableIsolationForActiveTab(tabId, coordinator));
        }
        case 'ui.deleteSession':
          await deleteSiteSession(request.sessionId, coordinator, bindingStore);
          return successResult({ deleted: true as const });
        case 'ui.renameSession':
          return successResult({
            session: await renameSiteSession(request.sessionId, request.name),
          });
        case 'ui.openSession':
          return successResult(await openSessionInNewTab(request.sessionId, senderTabId));
        default: {
          const exhaustive: never = request;
          return exhaustive;
        }
      }
    } catch (error) {
      if (error instanceof DomainError) {
        return domainErrorToResult(error);
      }
      logger.error('Unhandled UI request error', {
        type: request.type,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return {
        ok: false,
        code: 'ValidationFailed',
        message: 'Unexpected background error.',
        isolationSafe: true,
      };
    }
  }

  async function handleContentRequest(
    request: ContentRequest,
    senderTabId: number | undefined,
    senderTabUrl: string | undefined,
  ): Promise<Result<unknown>> {
    if (senderTabId === undefined) {
      return {
        ok: false,
        code: 'ValidationFailed',
        message: 'Content request missing tab id.',
        isolationSafe: true,
      };
    }

    try {
      const validated = parseContentRequest(request, senderTabUrl);
      switch (validated.type) {
        case 'content.hello':
          return successResult(await handleContentHello(senderTabId, validated.origin));
        case 'content.documentCookieGet':
          return successResult({
            value: await handleDocumentCookieGet(senderTabId, validated.href),
          });
        case 'content.documentCookieSet':
          await handleDocumentCookieSet(
            senderTabId,
            validated.href,
            validated.assignment,
          );
          return successResult({ applied: true as const });
        case 'content.storageOp':
          return {
            ok: false,
            code: 'ValidationFailed',
            message: 'Storage virtualization is not implemented.',
            isolationSafe: true,
          };
        default: {
          const exhaustive: never = validated;
          return exhaustive;
        }
      }
    } catch (error) {
      if (error instanceof DomainError) {
        return domainErrorToResult(error);
      }
      return {
        ok: false,
        code: 'ValidationFailed',
        message: error instanceof Error ? error.message : 'Invalid content request.',
        isolationSafe: true,
      };
    }
  }

  return {
    handleMessage(
      raw: unknown,
      sender: { tab?: { id?: number | undefined; url?: string | undefined } },
    ): Promise<Result<unknown>> {
      if (typeof raw !== 'object' || raw === null || !('type' in raw)) {
        return Promise.resolve({
          ok: false,
          code: 'ValidationFailed',
          message: 'Message missing type field.',
          isolationSafe: true,
        });
      }

      const type = (raw as { type: string }).type;
      if (type.startsWith('ui.')) {
        const request = parseUiRequest(raw);
        return resolveUiTabId(sender.tab?.id).then((tabId) =>
          handleUiRequest(request, tabId),
        );
      }
      if (type.startsWith('content.')) {
        return handleContentRequest(
          raw as ContentRequest,
          sender.tab?.id,
          sender.tab?.url,
        );
      }

      return Promise.resolve({
        ok: false,
        code: 'ValidationFailed',
        message: 'Unknown message type.',
        isolationSafe: true,
      });
    },
    getPopupSnapshot,
    async handleCommand(command: string): Promise<void> {
      const tabId = await resolveUiTabId(undefined);

      if (command === 'open-session-switcher') {
        try {
          await browser.action.openPopup();
          return;
        } catch {
          if (tabId !== undefined) {
            const { openSidePanel } =
              await import('../adapters/chrome/sidepanel-adapter.ts');
            await openSidePanel(asTabId(tabId));
          }
        }
        return;
      }

      if (tabId === undefined) {
        return;
      }

      if (command === 'new-temporary-session') {
        try {
          await createSiteSession({
            tabId,
            name: 'Temp',
            kind: 'temporary',
            coordinator,
          });
        } catch (error) {
          logger.warn('Command new-temporary-session failed', {
            error: error instanceof Error ? error.message : 'unknown',
          });
        }
        return;
      }

      if (command === 'next-session' || command === 'previous-session') {
        const snapshot = await getPopupSnapshot(tabId);
        const ids = snapshot.sessions.map((item) => item.session.id);
        const next = nextCycledId(
          ids,
          snapshot.currentSessionId,
          command === 'next-session' ? 1 : -1,
        );
        if (next === undefined || next === snapshot.currentSessionId) {
          return;
        }
        await switchTabSession(tabId, next);
        return;
      }

      if (command === 'duplicate-into-session') {
        const binding = await bindingStore.get(asTabId(tabId));
        if (
          binding !== undefined &&
          binding.sessionId !== UNASSIGNED_SESSION_ID &&
          binding.assignmentState === 'bound'
        ) {
          const tab = await browser.tabs.get(tabId);
          if (tab.url !== undefined && isIsolatableUrl(tab.url)) {
            const sessions = await listSessions(localPort);
            const session = sessions.find((entry) => entry.id === binding.sessionId);
            if (session !== undefined) {
              await openUrlInBoundSession({
                url: tab.url,
                session,
                domainGroupId: binding.domainGroupId,
                coordinator,
              });
              return;
            }
          }
        }
        await createSiteSession({
          tabId,
          name: 'Temp',
          kind: 'temporary',
          coordinator,
        });
      }
    },
  };
}
