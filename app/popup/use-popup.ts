import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { requestHostAccess } from '@/app/host-permission.ts';
import { sendUiMessage } from '@/app/messaging.ts';
import {
  EMPTY_POPUP_SNAPSHOT,
  type PopupSnapshot,
  type SessionListItem,
} from '@/app/types.ts';
import type { UiRequest } from '@/modules/messaging/protocol.ts';

type PopupState = {
  readonly snapshot: PopupSnapshot;
  readonly sessions: readonly SessionListItem[];
  readonly loading: boolean;
  readonly error: string | null;
};

async function ensureHostAccess(origin: string): Promise<string | null> {
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    return 'Open a website tab, then create a session.';
  }
  const granted = await requestHostAccess(origin);
  if (!granted) {
    return 'Allow access to this site when Chrome prompts, then retry.';
  }
  return null;
}

export function usePopupController(): PopupState & {
  readonly refresh: () => Promise<void>;
  readonly openSession: (sessionId: string) => Promise<string | null>;
  readonly switchSession: (sessionId: string) => Promise<string | null>;
  readonly createSession: (name: string) => Promise<string | null>;
  readonly createTemporarySession: () => Promise<string | null>;
  readonly renameSession: (sessionId: string, name: string) => Promise<string | null>;
  readonly deleteSession: (sessionId: string) => Promise<string | null>;
  readonly openManager: () => Promise<string | null>;
} {
  const [snapshot, setSnapshot] = useState<PopupSnapshot>(EMPTY_POPUP_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await sendUiMessage<PopupSnapshot>({ type: 'ui.getPopupSnapshot' });
    if (result.ok) {
      setSnapshot(result.data);
      setError(null);
    } else {
      setSnapshot(EMPTY_POPUP_SNAPSHOT);
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (request: UiRequest): Promise<string | null> => {
      const result = await sendUiMessage<unknown>(request);
      if (!result.ok) {
        return result.message;
      }
      await refresh();
      return null;
    },
    [refresh],
  );

  const withSiteAccess = useCallback(
    async (action: () => Promise<string | null>): Promise<string | null> => {
      const accessError = await ensureHostAccess(snapshot.origin);
      if (accessError !== null) {
        return accessError;
      }
      return action();
    },
    [snapshot.origin],
  );

  return {
    snapshot,
    sessions: snapshot.sessions,
    loading,
    error,
    refresh,
    openSession: (sessionId) => runAction({ type: 'ui.openSession', sessionId }),
    switchSession: (sessionId) =>
      withSiteAccess(() => runAction({ type: 'ui.switchTabSession', sessionId })),
    createSession: (name) =>
      withSiteAccess(() =>
        runAction({
          type: 'ui.createSession',
          name,
          attachToActiveTab: true,
        }),
      ),
    createTemporarySession: () =>
      withSiteAccess(() => runAction({ type: 'ui.createTemporarySession' })),
    renameSession: (sessionId, name) =>
      runAction({ type: 'ui.renameSession', sessionId, name }),
    deleteSession: (sessionId) => runAction({ type: 'ui.deleteSession', sessionId }),
    openManager: async () => {
      try {
        await browser.runtime.openOptionsPage();
        return null;
      } catch (caught: unknown) {
        return caught instanceof Error ? caught.message : 'Could not open the manager.';
      }
    },
  };
}
