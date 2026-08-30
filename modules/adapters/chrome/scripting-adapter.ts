import { browser } from 'wxt/browser';

export type RuntimeContentScript = {
  readonly id: string;
  readonly matches: readonly string[];
  readonly js: readonly string[];
  readonly runAt: 'document_start' | 'document_end' | 'document_idle';
  readonly world: 'ISOLATED' | 'MAIN';
};

export async function registerRuntimeContentScripts(
  scripts: readonly RuntimeContentScript[],
): Promise<void> {
  await browser.scripting.registerContentScripts(
    scripts.map((script) => ({
      id: script.id,
      matches: [...script.matches],
      js: [...script.js],
      runAt: script.runAt,
      world: script.world,
      persistAcrossSessions: false,
    })),
  );
}

export async function unregisterRuntimeContentScripts(
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await browser.scripting.unregisterContentScripts({ ids: [...ids] });
}
