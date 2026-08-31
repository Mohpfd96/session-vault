import { browser } from 'wxt/browser';
import { containsOriginPermission } from '../adapters/chrome/permissions-adapter.ts';
import { registrableDomain, isIpHost } from '../cookies/domain.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import { asDomainGroupId, createId } from '../domain/ids.ts';
import { DomainError, permissionDenied } from '../errors/index.ts';
import { loadDomainGroups } from '../domains/load-groups.ts';
import { findManagedDomainGroup, hostFromUrl } from '../domains/matcher.ts';
import {
  isolationScriptFile,
  syncIsolationContentScripts,
} from '../domains/sync-content-scripts.ts';
import { createChromeStorageLocalPort, saveDomainGroups } from '../persistence/index.ts';

const localPort = createChromeStorageLocalPort();

export type ManagedSite = {
  readonly tabId: number;
  readonly url: string;
  readonly origin: string;
  readonly host: string;
  readonly group: DomainGroup;
};

export async function injectIsolationScript(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [isolationScriptFile()],
      injectImmediately: true,
      world: 'ISOLATED',
    });
  } catch {
    // chrome:// and similar pages reject scripting; DNR still applies.
  }
}

export async function injectTabTitleMarker(tabId: number, emoji: string): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      injectImmediately: true,
      args: [emoji],
      func: (marker: string) => {
        const pattern = /^[🔴🟠🟡🟢🔵🟣🟤⚫⚪]\s*/u;
        const apply = (): void => {
          const current = document.title;
          const stripped = current.replace(pattern, '');
          const next = stripped.length === 0 ? `${marker} ` : `${marker} ${stripped}`;
          if (current !== next) {
            document.title = next;
          }
        };
        apply();
        const root = document.head ?? document.documentElement;
        new MutationObserver(apply).observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
        });
        const started = Date.now();
        const timer = window.setInterval(() => {
          apply();
          if (Date.now() - started > 12_000) {
            window.clearInterval(timer);
          }
        }, 300);
      },
    });
  } catch {
    // Page may not allow scripting.
  }
}

export async function parseHttpTab(tabId: number): Promise<{
  readonly url: string;
  readonly origin: string;
  readonly host: string;
}> {
  const tab = await browser.tabs.get(tabId);
  const url = tab.url;
  if (url === undefined) {
    throw new DomainError(
      'TabNotBound',
      'No website tab is focused.',
      true,
      'Click a tab like google.com, then open Session Vault again.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainError(
      'DomainNotManaged',
      'This tab URL cannot be isolated.',
      true,
      'Open a normal http(s) page.',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DomainError(
      'DomainNotManaged',
      'Only http(s) pages can be isolated.',
      true,
      'Open a website tab, for example google.com.',
    );
  }

  const host = hostFromUrl(url);
  if (host === undefined) {
    throw new DomainError(
      'DomainNotManaged',
      'Cannot resolve a hostname for this tab.',
      true,
      'Navigate to a supported site.',
    );
  }

  return { url, origin: parsed.origin, host };
}

export async function ensureManagedSite(tabId: number): Promise<ManagedSite> {
  const { url, origin, host } = await parseHttpTab(tabId);

  const alreadyGranted = await containsOriginPermission(origin);
  if (!alreadyGranted) {
    throw permissionDenied(
      `Allow Session Vault to access ${origin} when Chrome prompts from the popup or side panel, then try again.`,
    );
  }

  const registrable = registrableDomain(host) ?? host;
  const groups = [...(await loadDomainGroups(localPort))];
  let group = findManagedDomainGroup(host, url, groups);
  if (group !== undefined && isIpHost(host)) {
    const existing = group;
    const needsExactHost = existing.domains.some(
      (entry) => entry.type === 'registrable-domain' && isIpHost(entry.domain),
    );
    if (needsExactHost) {
      const repaired: DomainGroup = {
        ...existing,
        domains: [{ type: 'exact-host', host }],
        includeSubdomains: false,
        updatedAt: new Date().toISOString(),
      };
      const index = groups.findIndex((entry) => entry.id === existing.id);
      if (index >= 0) {
        groups[index] = repaired;
        await saveDomainGroups(localPort, groups);
      }
      group = repaired;
    }
  }
  if (group === undefined) {
    const now = new Date().toISOString();
    const created: DomainGroup = {
      id: asDomainGroupId(createId('dg')),
      name: registrable,
      domains: isIpHost(host)
        ? [{ type: 'exact-host', host }]
        : [
            {
              type: 'registrable-domain',
              domain: registrable,
              includeSubdomains: true,
            },
          ],
      includeSubdomains: !isIpHost(host),
      exclusions: [],
      mode: 'managed',
      createdAt: now,
      updatedAt: now,
    };
    groups.push(created);
    await saveDomainGroups(localPort, groups);
    group = created;
  }

  await syncIsolationContentScripts(groups);

  return { tabId, url, origin, host, group };
}
