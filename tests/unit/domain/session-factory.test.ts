import { describe, expect, it } from 'vitest';
import {
  applySessionMarker,
  createPersistentSession,
  createSessionProfile,
  createTemporarySession,
  SESSION_SWATCHES,
  stripSessionMarker,
} from '../../../modules/domain/session-factory.ts';
import { markSessionReady } from '../../../modules/domain/lifecycle.ts';

const NOW = '2026-01-01T00:00:00.000Z';

describe('session factory', () => {
  it('creates persistent sessions with unique sequential names and circle markers', () => {
    const first = createPersistentSession([], [], NOW);
    const second = createPersistentSession([first.name], [first], NOW);

    expect(first.name).toBe('🔴 Session 1');
    expect(second.name).toBe('🟠 Session 2');
    expect(first.icon).toBe('🔴');
    expect(second.icon).toBe('🟠');
    expect(first.kind).toBe('persistent');
    expect(first.state).toBe('creating');
    expect(first.id.startsWith('ses_')).toBe(true);
  });

  it('creates temporary sessions named Temp N with markers', () => {
    const first = createTemporarySession([], [], NOW);
    const second = createTemporarySession([first.name], [first], NOW);

    expect(first.name).toBe('🔴 Temp 1');
    expect(second.name).toBe('🟠 Temp 2');
    expect(first.kind).toBe('temporary');
  });

  it('prefixes a custom name with the next unused circle', () => {
    const session = createSessionProfile(
      {
        kind: 'persistent',
        existingNames: [],
        name: 'Work',
        now: NOW,
      },
      [],
    );
    expect(session.name).toBe('🔴 Work');
    expect(session.icon).toBe('🔴');
    expect(session.color).toBe('#E11D48');
  });

  it('assigns a unique color and emoji for each session', () => {
    const created: ReturnType<typeof createPersistentSession>[] = [];
    let names: string[] = [];
    for (let index = 0; index < SESSION_SWATCHES.length; index += 1) {
      const session = createPersistentSession(names, created, NOW);
      created.push(session);
      names = created.map((entry) => entry.name);
    }
    const emojis = created.map((session) => session.icon);
    const colors = created.map((session) => session.color);
    expect(new Set(emojis).size).toBe(SESSION_SWATCHES.length);
    expect(new Set(colors).size).toBe(SESSION_SWATCHES.length);
  });

  it('does not double-prefix an existing marker', () => {
    expect(applySessionMarker('🔴 Work', '🟠')).toBe('🟠 Work');
    expect(stripSessionMarker('🟢 Personal')).toBe('Personal');
  });

  it('uses ISO-8601 timestamps', () => {
    const session = createPersistentSession([], [], NOW);
    expect(session.createdAt).toBe(NOW);
    expect(session.updatedAt).toBe(NOW);
    expect(session.lastUsedAt).toBe(NOW);
  });

  it('produces ready sessions after lifecycle mark', () => {
    const session = markSessionReady(createTemporarySession([], [], NOW), NOW);
    expect(session.state).toBe('ready');
    expect(session.settings.inheritToChildTabs).toBe(true);
  });
});
