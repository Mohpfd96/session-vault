import type { DomainGroup } from '../domain/domain-group.ts';
import type { SessionProfile } from '../domain/session-profile.ts';
import type { TabBinding } from '../domain/tab-binding.ts';
import type { SessionId, TabId } from '../domain/ids.ts';
import {
  findManagedDomainGroup,
  hostFromUrl,
  matchesDomainGroup,
} from '../domains/matcher.ts';
import type { IsolationProvider } from '../isolation/provider.ts';
import { logger } from '../logging/index.ts';
import { getTab, queryTabs } from '../adapters/chrome/tabs-adapter.ts';
import { isIsolatableUrl } from './active-tab.ts';
import { isAssignedSessionBinding } from './binding-state.ts';
import { UNASSIGNED_SESSION_ID } from './constants.ts';
import type { TabBindingStore } from './binding-store.ts';
import { dropStaleBindings } from './binding-store.ts';

export type TabCoordinatorDeps = {
  readonly bindingStore: TabBindingStore;
  readonly isolation: IsolationProvider;
  readonly loadDomainGroups: () => Promise<readonly DomainGroup[]>;
  readonly getSession: (sessionId: SessionId) => Promise<SessionProfile | undefined>;
  readonly onBindingChanged?: (tabId: TabId) => void;
};

export function createTabCoordinator(deps: TabCoordinatorDeps) {
  const { bindingStore, isolation, loadDomainGroups, getSession, onBindingChanged } =
    deps;

  function notifyBindingChanged(tabId: TabId): void {
    onBindingChanged?.(tabId);
  }

  async function unbindTab(tabId: TabId): Promise<void> {
    await isolation.unbindTab(tabId);
    await bindingStore.delete(tabId);
    notifyBindingChanged(tabId);
  }

  async function bindTabToSession(
    tabId: TabId,
    session: SessionProfile,
    domainGroupId: DomainGroup['id'],
    assignmentState: TabBinding['assignmentState'] = 'bound',
    destinationUrl?: string,
  ): Promise<TabBinding> {
    const now = Date.now();
    const tab = await getTab(tabId);
    const url = destinationUrl ?? tab?.url;
    const result = await isolation.bindTab({
      tabId,
      sessionId: session.id,
      domainGroupId,
      assignmentState,
      ...(url !== undefined ? { url } : {}),
    });

    const binding: TabBinding = {
      tabId,
      sessionId: session.id,
      domainGroupId,
      assignmentState: result.assignmentState,
      createdAt: now,
      lastVerifiedAt: now,
    };
    await bindingStore.set(binding);
    notifyBindingChanged(tabId);
    return binding;
  }

  async function assignUnmanagedFailClosed(
    tabId: TabId,
    domainGroup: DomainGroup,
  ): Promise<TabBinding> {
    await isolation.installFailClosedStrip(tabId);
    const now = Date.now();
    const binding: TabBinding = {
      tabId,
      sessionId: UNASSIGNED_SESSION_ID,
      domainGroupId: domainGroup.id,
      assignmentState: 'unassigned',
      createdAt: now,
      lastVerifiedAt: now,
    };
    await bindingStore.set(binding);
    notifyBindingChanged(tabId);
    return binding;
  }

  async function handleTabRemoved(tabId: TabId): Promise<SessionId | undefined> {
    const binding = await bindingStore.get(tabId);
    await unbindTab(tabId);
    return binding?.sessionId;
  }

  function hrefForInherit(tab: {
    readonly url: string | undefined;
    readonly pendingUrl?: string | undefined;
  }): string | undefined {
    if (isIsolatableUrl(tab.url)) {
      return tab.url;
    }
    if (isIsolatableUrl(tab.pendingUrl)) {
      return tab.pendingUrl;
    }
    return undefined;
  }

  async function maybeInheritFromOpener(
    tabId: TabId,
    openerTabId: TabId,
    href: string,
  ): Promise<void> {
    const existing = await bindingStore.get(tabId);
    if (existing !== undefined) {
      return;
    }
    const openerBinding = await bindingStore.get(openerTabId);
    if (openerBinding === undefined) {
      return;
    }
    const host = hostFromUrl(href);
    if (host === undefined) {
      return;
    }
    const groups = await loadDomainGroups();
    const openerGroup = groups.find((group) => group.id === openerBinding.domainGroupId);
    if (openerGroup === undefined || !matchesDomainGroup(host, href, openerGroup)) {
      return;
    }
    if (openerBinding.sessionId === UNASSIGNED_SESSION_ID) {
      await assignUnmanagedFailClosed(tabId, openerGroup);
      return;
    }
    const session = await getSession(openerBinding.sessionId);
    if (session === undefined || !session.settings.inheritToChildTabs) {
      return;
    }
    await bindTabToSession(tabId, session, openerBinding.domainGroupId, 'bound', href);
  }

  async function handleTabCreated(tab: {
    readonly id: TabId;
    readonly openerTabId: TabId | undefined;
    readonly url: string | undefined;
    readonly pendingUrl?: string | undefined;
  }): Promise<void> {
    if (tab.openerTabId === undefined) {
      return;
    }
    const href = hrefForInherit(tab);
    if (href === undefined) {
      return;
    }
    await maybeInheritFromOpener(tab.id, tab.openerTabId, href);
  }

  async function handleNavigationCommitted(tabId: TabId, url: string): Promise<void> {
    if (!isIsolatableUrl(url)) {
      return;
    }
    const host = hostFromUrl(url);
    if (host === undefined) {
      return;
    }

    let binding = await bindingStore.get(tabId);
    if (binding === undefined) {
      const tab = await getTab(tabId);
      if (tab?.openerTabId !== undefined) {
        await maybeInheritFromOpener(tabId, tab.openerTabId, url);
        binding = await bindingStore.get(tabId);
      }
    }
    if (binding === undefined) {
      return;
    }

    const groups = await loadDomainGroups();
    const group = groups.find((entry) => entry.id === binding.domainGroupId);

    if (!isAssignedSessionBinding(binding)) {
      await isolation.installFailClosedStrip(tabId);
      return;
    }

    if (group === undefined || !matchesDomainGroup(host, url, group)) {
      const managed = findManagedDomainGroup(host, url, groups);
      if (managed !== undefined) {
        await assignUnmanagedFailClosed(tabId, managed);
      } else {
        await unbindTab(tabId);
      }
      return;
    }

    const session = await getSession(binding.sessionId);
    if (session === undefined) {
      await assignUnmanagedFailClosed(tabId, group);
      return;
    }

    await bindTabToSession(tabId, session, binding.domainGroupId, 'bound', url);
  }

  async function reconcileOpenTabs(): Promise<void> {
    const tabs = await queryTabs();
    const openTabIds = new Set(tabs.map((tab) => tab.id));
    const bindings = await bindingStore.getAll();
    const stale = bindings.filter((binding) => !openTabIds.has(binding.tabId));

    for (const binding of stale) {
      await unbindTab(binding.tabId);
    }

    const freshBindings = dropStaleBindings(
      bindings.filter((binding) => openTabIds.has(binding.tabId)),
      openTabIds,
    );

    const groups = await loadDomainGroups();
    const boundTabIds = new Set(freshBindings.map((binding) => binding.tabId));

    for (const tab of tabs) {
      if (tab.url === undefined || !isIsolatableUrl(tab.url)) {
        continue;
      }

      const host = hostFromUrl(tab.url);
      if (host === undefined) {
        continue;
      }

      const managedGroup = findManagedDomainGroup(host, tab.url, groups);
      if (managedGroup === undefined) {
        continue;
      }

      const existing = freshBindings.find((binding) => binding.tabId === tab.id);
      if (existing !== undefined) {
        if (!isAssignedSessionBinding(existing)) {
          await isolation.installFailClosedStrip(existing.tabId);
          continue;
        }
        const session = await getSession(existing.sessionId);
        if (session === undefined) {
          await assignUnmanagedFailClosed(existing.tabId, managedGroup);
          continue;
        }
        await bindTabToSession(
          existing.tabId,
          session,
          existing.domainGroupId,
          'bound',
          tab.url,
        );
        continue;
      }

      if (boundTabIds.has(tab.id)) {
        continue;
      }

      logger.info('Reconciling unassigned managed tab after recovery', {
        tabId: tab.id,
        host,
      });
      await assignUnmanagedFailClosed(tab.id, managedGroup);
    }
  }

  return {
    unbindTab,
    bindTabToSession,
    assignUnmanagedFailClosed,
    handleTabRemoved,
    handleTabCreated,
    handleNavigationCommitted,
    reconcileOpenTabs,
    refreshTabAppearance: notifyBindingChanged,
  };
}

export type TabCoordinator = ReturnType<typeof createTabCoordinator>;
