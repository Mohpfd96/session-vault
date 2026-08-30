import { z } from 'zod';
import { domainGroupSchema } from '../domain/schemas.ts';
import type { DomainGroup } from '../domain/domain-group.ts';
import { asDomainGroupId } from '../domain/ids.ts';
import { logger } from '../logging/index.ts';
import type { ChromeStorageLocalPort } from '../persistence/ports/chrome-storage-local.ts';
import { STORAGE_KEYS } from '../persistence/keys.ts';

const domainGroupIndexSchema = z.object({
  groups: z.array(domainGroupSchema),
});

export async function loadDomainGroups(
  localPort: ChromeStorageLocalPort,
): Promise<readonly DomainGroup[]> {
  const raw = await localPort.get<unknown>(STORAGE_KEYS.domainGroups);
  if (raw === undefined) {
    return [];
  }

  const indexParsed = z.object({ groups: z.array(z.unknown()) }).safeParse(raw);
  if (!indexParsed.success) {
    logger.warn('Domain group index failed validation');
    return [];
  }

  const parsed = domainGroupIndexSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('Domain groups failed validation', {
      issues: parsed.error.issues.length,
    });
    return [];
  }

  return parsed.data.groups.map((group) => ({
    ...group,
    id: asDomainGroupId(group.id),
  }));
}
