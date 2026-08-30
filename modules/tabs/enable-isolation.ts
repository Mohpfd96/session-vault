import { getNativeCookiesForUrl } from '../adapters/chrome/cookies-adapter.ts';
import { mapNativeCookie } from '../cookies/native-import.ts';
import { markSessionReady } from '../domain/lifecycle.ts';
import { asTabId, type SessionId } from '../domain/ids.ts';
import { createSessionProfile } from '../domain/session-factory.ts';
import {
  createChromeStorageLocalPort,
  createIndexedDbPort,
  listSessions,
  replaceSessionCookies,
  upsertSession,
} from '../persistence/index.ts';
import type { TabCoordinator } from './coordinator.ts';
import {
  ensureManagedSite,
  injectIsolationScript,
  injectTabTitleMarker,
} from './ensure-managed-site.ts';
import { reloadTabQuietly } from './session-actions.ts';

const localPort = createChromeStorageLocalPort();
const idb = createIndexedDbPort();

export async function enableIsolationForActiveTab(
  tabId: number,
  coordinator: TabCoordinator,
): Promise<{ sessionId: SessionId; domainGroupId: string }> {
  const site = await ensureManagedSite(tabId);
  const sessions = await listSessions(localPort);
  let session = sessions.find((entry) => entry.domainGroupIds.includes(site.group.id));
  if (session === undefined) {
    let profile = createSessionProfile(
      {
        kind: 'persistent',
        existingNames: sessions.map((entry) => entry.name),
        name: 'Default',
      },
      sessions,
    );
    profile = {
      ...profile,
      domainGroupIds: [site.group.id],
    };
    profile = markSessionReady(profile, new Date().toISOString());
    await upsertSession(localPort, profile);
    session = profile;

    const now = Date.now();
    const native = await getNativeCookiesForUrl(site.url);
    const imported = native.map((cookie) => mapNativeCookie(cookie, profile.id, now));
    await replaceSessionCookies(idb, profile.id, imported);
  }

  await coordinator.bindTabToSession(
    asTabId(tabId),
    session,
    site.group.id,
    'bound',
    site.url,
  );
  await injectIsolationScript(tabId);
  await injectTabTitleMarker(tabId, session.icon);
  coordinator.refreshTabAppearance(asTabId(tabId));
  await reloadTabQuietly(tabId);

  return { sessionId: session.id, domainGroupId: site.group.id };
}
