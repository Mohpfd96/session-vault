import {
  registerRuntimeContentScripts,
  unregisterRuntimeContentScripts,
} from '../adapters/chrome/scripting-adapter.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import { logger } from '../logging/index.ts';
import { matchPatternsForGroups } from './match-patterns.ts';

const ISOLATION_SCRIPT_ID = 'sessionvault-isolation';
const ISOLATION_SCRIPT_FILE = '/content-scripts/isolation.js' as const;

export async function syncIsolationContentScripts(
  groups: readonly DomainGroup[],
): Promise<void> {
  const matches = matchPatternsForGroups(groups);
  try {
    await unregisterRuntimeContentScripts([ISOLATION_SCRIPT_ID]);
  } catch {
    // Script may not be registered yet.
  }
  if (matches.length === 0) {
    return;
  }
  try {
    await registerRuntimeContentScripts([
      {
        id: ISOLATION_SCRIPT_ID,
        matches,
        js: ['content-scripts/isolation.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
      },
    ]);
  } catch (error) {
    logger.warn('Failed to register isolation content scripts', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export function isolationScriptFile(): '/content-scripts/isolation.js' {
  return ISOLATION_SCRIPT_FILE;
}
