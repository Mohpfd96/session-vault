import { z } from 'zod';
import type { SessionProfile } from '../domain/session-profile.ts';
import type { TabBinding } from '../domain/tab-binding.ts';
import type { Result } from './protocol.ts';
import type { PopupSnapshot } from './snapshots.ts';

export type { PopupSnapshot } from './snapshots.ts';

export type ContentHelloResponse = {
  readonly managed: boolean;
  readonly assignmentState: TabBinding['assignmentState'] | 'none';
  readonly tabMarker?: string;
};

export type DocumentCookieResponse = {
  readonly value: string;
};

export type BackgroundRouterDeps = {
  readonly listSessions: () => Promise<readonly SessionProfile[]>;
  readonly createPersistentSession: (input: {
    name: string;
    color?: string;
    icon?: string;
  }) => Promise<SessionProfile>;
  readonly createTemporarySessionProfile: () => Promise<SessionProfile>;
  readonly switchTabSession: (tabId: number, sessionId: string) => Promise<TabBinding>;
  readonly openSidePanel: (tabId: number) => Promise<void>;
  readonly getPopupSnapshot: (tabId: number | undefined) => Promise<PopupSnapshot>;
  readonly handleContentHello: (
    tabId: number,
    origin: string,
  ) => Promise<ContentHelloResponse>;
  readonly handleDocumentCookieGet: (tabId: number) => Promise<string>;
  readonly handleDocumentCookieSet: (tabId: number, assignment: string) => Promise<void>;
};

export const backgroundResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({
    ok: z.literal(false),
    code: z.string(),
    message: z.string(),
    isolationSafe: z.boolean(),
  }),
]);

export function successResult<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function errorResult(error: {
  code: string;
  message: string;
  isolationSafe: boolean;
}): Result<never> {
  return {
    ok: false,
    code: error.code,
    message: error.message,
    isolationSafe: error.isolationSafe,
  };
}

export function domainErrorToResult(error: {
  code: string;
  message: string;
  isolationSafe: boolean;
}): Result<never> {
  return errorResult(error);
}
