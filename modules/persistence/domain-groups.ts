import { domainGroupSchema } from '../domain/schemas.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import { asDomainGroupId } from '../domain/ids.ts';
import { storageCorrupted } from '../errors/index.ts';
import type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
import { STORAGE_KEYS } from './keys.ts';
import { z } from 'zod';

const domainGroupIndexSchema = z.object({
  groups: z.array(domainGroupSchema),
});

export async function saveDomainGroups(
  localPort: ChromeStorageLocalPort,
  groups: readonly DomainGroup[],
): Promise<void> {
  const parsed = domainGroupIndexSchema.safeParse({ groups });
  if (!parsed.success) {
    throw storageCorrupted('Cannot persist invalid domain groups.');
  }
  await localPort.set(STORAGE_KEYS.domainGroups, parsed.data);
}

export function toDomainGroup(group: z.infer<typeof domainGroupSchema>): DomainGroup {
  return {
    ...group,
    id: asDomainGroupId(group.id),
  };
}
