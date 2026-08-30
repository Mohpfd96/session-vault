import { z } from 'zod';
import { tabBindingSchema } from '../domain/schemas.ts';
import { asDomainGroupId, asSessionId, asTabId } from '../domain/ids.ts';
import type { TabBinding } from '../domain/tab-binding.ts';
import { storageCorrupted } from '../errors/index.ts';
import { STORAGE_KEYS } from '../persistence/keys.ts';

const bindingIndexSchema = z.object({
  bindings: z.array(tabBindingSchema),
});

export type TabBindingStore = {
  get(tabId: number): Promise<TabBinding | undefined>;
  getAll(): Promise<readonly TabBinding[]>;
  set(binding: TabBinding): Promise<void>;
  delete(tabId: number): Promise<void>;
  clear(): Promise<void>;
};

function parseBinding(raw: unknown, context: string): TabBinding {
  const parsed = tabBindingSchema.safeParse(raw);
  if (!parsed.success) {
    throw storageCorrupted(`Invalid tab binding (${context}).`);
  }
  return {
    ...parsed.data,
    tabId: asTabId(parsed.data.tabId),
    sessionId: asSessionId(parsed.data.sessionId),
    domainGroupId: asDomainGroupId(parsed.data.domainGroupId),
  };
}

export function createMemoryTabBindingStore(): TabBindingStore {
  const bindings = new Map<number, TabBinding>();

  return {
    async get(tabId) {
      return bindings.get(tabId);
    },
    async getAll() {
      return [...bindings.values()];
    },
    async set(binding) {
      bindings.set(binding.tabId, binding);
    },
    async delete(tabId) {
      bindings.delete(tabId);
    },
    async clear() {
      bindings.clear();
    },
  };
}

export function createSessionTabBindingStore(storage: {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}): TabBindingStore {
  async function readIndex(): Promise<readonly TabBinding[]> {
    const raw = await storage.get<unknown>(STORAGE_KEYS.bindings);
    if (raw === undefined) {
      return [];
    }
    const parsed = bindingIndexSchema.safeParse(raw);
    if (!parsed.success) {
      throw storageCorrupted('Stored tab bindings are invalid.');
    }
    return parsed.data.bindings.map((binding, index) =>
      parseBinding(binding, `index[${index}]`),
    );
  }

  async function writeIndex(bindings: readonly TabBinding[]): Promise<void> {
    const validated = bindingIndexSchema.parse({
      bindings: bindings.map((binding) => ({
        ...binding,
        tabId: binding.tabId,
        sessionId: binding.sessionId,
        domainGroupId: binding.domainGroupId,
      })),
    });
    await storage.set(STORAGE_KEYS.bindings, validated);
  }

  return {
    async get(tabId) {
      const bindings = await readIndex();
      return bindings.find((binding) => binding.tabId === tabId);
    },
    async getAll() {
      return readIndex();
    },
    async set(binding) {
      const bindings = await readIndex();
      const next = bindings.filter((entry) => entry.tabId !== binding.tabId);
      await writeIndex([...next, binding]);
    },
    async delete(tabId) {
      const bindings = await readIndex();
      await writeIndex(bindings.filter((binding) => binding.tabId !== tabId));
    },
    async clear() {
      await storage.set(STORAGE_KEYS.bindings, { bindings: [] });
    },
  };
}

export function dropStaleBindings(
  bindings: readonly TabBinding[],
  openTabIds: ReadonlySet<number>,
): readonly TabBinding[] {
  return bindings.filter((binding) => openTabIds.has(binding.tabId));
}
