import type { DomainGroupId, SessionId, TabId } from './ids.ts';
import type { AssignmentState } from './enums.ts';

export type TabBinding = {
  readonly tabId: TabId;
  readonly sessionId: SessionId;
  readonly domainGroupId: DomainGroupId;
  readonly assignmentState: AssignmentState;
  readonly createdAt: number;
  readonly lastVerifiedAt: number;
};
