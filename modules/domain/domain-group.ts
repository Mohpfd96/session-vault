import type { DomainGroupId } from './ids.ts';
import type { DomainEntry } from './enums.ts';

export type DomainGroup = {
  readonly id: DomainGroupId;
  readonly name: string;
  readonly domains: readonly DomainEntry[];
  readonly includeSubdomains: boolean;
  readonly exclusions: readonly DomainEntry[];
  readonly mode: 'managed' | 'unmanaged';
  readonly createdAt: string;
  readonly updatedAt: string;
};
