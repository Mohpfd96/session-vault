import type { SessionKind } from './enums.ts';
import { asSessionId, createId } from './ids.ts';
import type { SessionProfile } from './session-profile.ts';
import { DEFAULT_SESSION_SETTINGS } from './session-profile.ts';

export type SessionSwatch = {
  readonly emoji: string;
  readonly color: string;
};

export const SESSION_SWATCHES: readonly SessionSwatch[] = [
  { emoji: '🔴', color: '#E11D48' },
  { emoji: '🟠', color: '#F97316' },
  { emoji: '🟡', color: '#CA8A04' },
  { emoji: '🟢', color: '#16A34A' },
  { emoji: '🔵', color: '#2563EB' },
  { emoji: '🟣', color: '#9333EA' },
  { emoji: '🟤', color: '#A16207' },
  { emoji: '⚫', color: '#171717' },
  { emoji: '⚪', color: '#E5E5E5' },
];

const SESSION_MARKER_PATTERN = /^[🔴🟠🟡🟢🔵🟣🟤⚫⚪]\s*/u;

export type CreateSessionInput = {
  readonly kind: SessionKind;
  readonly existingNames: readonly string[];
  readonly now?: string;
  readonly name?: string;
  readonly color?: string;
  readonly icon?: string;
};

function isoNow(provided?: string): string {
  return provided ?? new Date().toISOString();
}

export function stripSessionMarker(name: string): string {
  return name.replace(SESSION_MARKER_PATTERN, '').trim();
}

export function applySessionMarker(name: string, emoji: string): string {
  const stripped = stripSessionMarker(name);
  const label = stripped.length > 0 ? stripped : 'Session';
  return `${emoji} ${label}`;
}

export function pickNextSwatch(sessions: readonly SessionProfile[]): SessionSwatch {
  const usedEmojis = new Set(sessions.map((session) => session.icon));
  const usedColors = new Set(sessions.map((session) => session.color));
  for (const swatch of SESSION_SWATCHES) {
    if (!usedEmojis.has(swatch.emoji) && !usedColors.has(swatch.color)) {
      return swatch;
    }
  }
  const index = sessions.length % SESSION_SWATCHES.length;
  const fallback: SessionSwatch = { emoji: '🔴', color: '#E11D48' };
  return SESSION_SWATCHES[index] ?? fallback;
}

export function isLightSwatch(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (normalized.length < 6) {
    return false;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
    return false;
  }
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.72;
}

function nextSequentialName(prefix: string, existingNames: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`, 'u');
  let max = 0;
  for (const name of existingNames) {
    const match = pattern.exec(stripSessionMarker(name));
    if (match !== null) {
      const value = Number.parseInt(match[1] ?? '', 10);
      if (!Number.isNaN(value) && value > max) {
        max = value;
      }
    }
  }
  return `${prefix} ${max + 1}`;
}

function defaultName(kind: SessionKind, existingNames: readonly string[]): string {
  if (kind === 'temporary') {
    return nextSequentialName('Temp', existingNames);
  }
  return nextSequentialName('Session', existingNames);
}

export function createSessionProfile(
  input: CreateSessionInput,
  existingSessions: readonly SessionProfile[] = [],
): SessionProfile {
  const now = isoNow(input.now);
  const swatch = pickNextSwatch(existingSessions);
  const icon = input.icon ?? swatch.emoji;
  const color = input.color ?? swatch.color;
  const baseName = input.name ?? defaultName(input.kind, input.existingNames);
  const name = applySessionMarker(baseName, icon);

  return {
    id: asSessionId(createId('ses')),
    name,
    color,
    icon,
    kind: input.kind,
    state: 'creating',
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    pinned: false,
    archived: false,
    locked: false,
    tags: [],
    notes: '',
    strictness: 'compatibility',
    domainGroupIds: [],
    settings: { ...DEFAULT_SESSION_SETTINGS },
  };
}

export function createPersistentSession(
  existingNames: readonly string[],
  existingSessions: readonly SessionProfile[] = [],
  now?: string,
): SessionProfile {
  return createSessionProfile(
    {
      kind: 'persistent',
      existingNames,
      ...(now !== undefined ? { now } : {}),
    },
    existingSessions,
  );
}

export function createTemporarySession(
  existingNames: readonly string[],
  existingSessions: readonly SessionProfile[] = [],
  now?: string,
): SessionProfile {
  return createSessionProfile(
    {
      kind: 'temporary',
      existingNames,
      ...(now !== undefined ? { now } : {}),
    },
    existingSessions,
  );
}
