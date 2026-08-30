import type { TabBinding } from '../domain/tab-binding.ts';
import { UNASSIGNED_SESSION_ID } from './constants.ts';

export function isAssignedSessionBinding(binding: TabBinding | undefined): boolean {
  if (binding === undefined || binding.sessionId === UNASSIGNED_SESSION_ID) {
    return false;
  }
  return binding.assignmentState === 'bound' || binding.assignmentState === 'degraded';
}
