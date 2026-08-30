import { z } from 'zod';
import { sessionProfileSchema } from '../domain/schemas.ts';
import { asDomainGroupId, asSessionId, type SessionId } from '../domain/ids.ts';
import type { SessionProfile, SessionSettings } from '../domain/session-profile.ts';
import { sessionNotFound, storageCorrupted } from '../errors/index.ts';
import { logger } from '../logging/index.ts';
import type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
import { STORAGE_KEYS } from './keys.ts';

const sessionIndexSchema = z.object({
  sessions: z.array(sessionProfileSchema),
});

type StoredSessionProfile = z.infer<typeof sessionProfileSchema>;

export type SessionIndex = {
  readonly sessions: SessionProfile[];
};

function toSessionSettings(settings: StoredSessionProfile['settings']): SessionSettings {
  const base: SessionSettings = {
    inheritToChildTabs: settings.inheritToChildTabs,
    tabGroupIntegration: settings.tabGroupIntegration,
    cloneSessionStorageOnDuplicate: settings.cloneSessionStorageOnDuplicate,
    temporaryCleanup: settings.temporaryCleanup,
  };
  if (settings.gracePeriodMs === undefined) {
    return base;
  }
  return { ...base, gracePeriodMs: settings.gracePeriodMs };
}

function toSessionProfile(data: StoredSessionProfile): SessionProfile {
  return {
    id: asSessionId(data.id),
    name: data.name,
    color: data.color,
    icon: data.icon,
    kind: data.kind,
    state: data.state,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastUsedAt: data.lastUsedAt,
    pinned: data.pinned,
    archived: data.archived,
    locked: data.locked,
    tags: [...data.tags],
    notes: data.notes,
    strictness: data.strictness,
    domainGroupIds: data.domainGroupIds.map(asDomainGroupId),
    settings: toSessionSettings(data.settings),
  };
}

function toStoredSessionProfile(profile: SessionProfile): StoredSessionProfile {
  const settings: StoredSessionProfile['settings'] = {
    inheritToChildTabs: profile.settings.inheritToChildTabs,
    tabGroupIntegration: profile.settings.tabGroupIntegration,
    cloneSessionStorageOnDuplicate: profile.settings.cloneSessionStorageOnDuplicate,
    temporaryCleanup: profile.settings.temporaryCleanup,
    ...(profile.settings.gracePeriodMs !== undefined
      ? { gracePeriodMs: profile.settings.gracePeriodMs }
      : {}),
  };

  return {
    id: profile.id,
    name: profile.name,
    color: profile.color,
    icon: profile.icon,
    kind: profile.kind,
    state: profile.state,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastUsedAt: profile.lastUsedAt,
    pinned: profile.pinned,
    archived: profile.archived,
    locked: profile.locked,
    tags: [...profile.tags],
    notes: profile.notes,
    strictness: profile.strictness,
    domainGroupIds: profile.domainGroupIds.map((id) => String(id)),
    settings,
  };
}

function parseSessionProfile(raw: unknown, context: string): SessionProfile {
  const parsed = sessionProfileSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('Session profile failed validation', {
      context,
      issues: parsed.error.issues.length,
    });
    throw storageCorrupted(`Stored session profile is invalid (${context}).`);
  }

  return toSessionProfile(parsed.data);
}

function parseSessionIndex(raw: unknown): SessionIndex {
  const parsed = sessionIndexSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('Session index failed validation', {
      issues: parsed.error.issues.length,
    });
    throw storageCorrupted('Stored session index is invalid.');
  }

  return {
    sessions: parsed.data.sessions.map((session, index) =>
      parseSessionProfile(session, `index[${index}]`),
    ),
  };
}

async function readSessionIndex(port: ChromeStorageLocalPort): Promise<SessionIndex> {
  const raw = await port.get<unknown>(STORAGE_KEYS.sessions);
  if (raw === undefined) {
    return { sessions: [] };
  }
  return parseSessionIndex(raw);
}

async function writeSessionIndex(
  port: ChromeStorageLocalPort,
  index: SessionIndex,
): Promise<void> {
  const stored = {
    sessions: index.sessions.map(toStoredSessionProfile),
  };
  const validated = sessionIndexSchema.parse(stored);
  await port.set(STORAGE_KEYS.sessions, validated);
}

export async function listSessions(
  port: ChromeStorageLocalPort,
): Promise<SessionProfile[]> {
  const index = await readSessionIndex(port);
  return index.sessions;
}

export async function getSession(
  port: ChromeStorageLocalPort,
  sessionId: SessionId,
): Promise<SessionProfile> {
  const index = await readSessionIndex(port);
  const session = index.sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw sessionNotFound(sessionId);
  }
  return session;
}

export async function upsertSession(
  port: ChromeStorageLocalPort,
  profile: SessionProfile,
): Promise<void> {
  sessionProfileSchema.parse(toStoredSessionProfile(profile));
  const index = await readSessionIndex(port);

  const existingIndex = index.sessions.findIndex((session) => session.id === profile.id);
  const sessions =
    existingIndex === -1
      ? [...index.sessions, profile]
      : index.sessions.map((session, position) =>
          position === existingIndex ? profile : session,
        );

  await writeSessionIndex(port, { sessions });
}

export async function deleteSession(
  port: ChromeStorageLocalPort,
  sessionId: SessionId,
): Promise<void> {
  const index = await readSessionIndex(port);
  const sessions = index.sessions.filter((session) => session.id !== sessionId);
  if (sessions.length === index.sessions.length) {
    throw sessionNotFound(sessionId);
  }
  await writeSessionIndex(port, { sessions });
}

export function validateSessionProfile(raw: unknown): SessionProfile {
  return parseSessionProfile(raw, 'validate');
}
