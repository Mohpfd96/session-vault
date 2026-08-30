import type { TabBinding } from '../domain/tab-binding.ts';
import { isAssignedSessionBinding } from './binding-state.ts';

export function shouldSyncToolbarIconOnTabUpdate(changeInfo: {
  readonly status?: string | undefined;
  readonly url?: string | undefined;
}): boolean {
  return (
    changeInfo.status === 'complete' ||
    changeInfo.status === 'loading' ||
    changeInfo.url !== undefined
  );
}

export function isToolbarIconFilled(binding: TabBinding | undefined): boolean {
  return isAssignedSessionBinding(binding);
}
