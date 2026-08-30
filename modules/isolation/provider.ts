import type { AssignmentState, IsolationLevel } from '../domain/enums.ts';
import type { DomainGroupId, Origin, SessionId, TabId } from '../domain/ids.ts';

export type IsolationProviderKind = 'virtual-extension' | 'native-profile';

export type BindTabInput = {
  readonly tabId: TabId;
  readonly sessionId: SessionId;
  readonly domainGroupId: DomainGroupId;
  readonly assignmentState?: AssignmentState;
  readonly url?: string;
};

export type IsolationResult = {
  readonly assignmentState: AssignmentState;
  readonly ruleIds: readonly number[];
};

export type SafeNavigateInput = {
  readonly url: string;
  readonly sessionId: SessionId;
  readonly domainGroupId: DomainGroupId;
};

export type RuleRebuildScope = {
  readonly tabIds: readonly TabId[];
};

export type CompatibilityReport = {
  readonly level: IsolationLevel;
  readonly reasons: readonly string[];
};

export interface IsolationProvider {
  readonly kind: IsolationProviderKind;
  bindTab(input: BindTabInput): Promise<IsolationResult>;
  unbindTab(tabId: TabId): Promise<void>;
  navigateSafely(input: SafeNavigateInput): Promise<TabId>;
  rebuildRules(scope: RuleRebuildScope): Promise<readonly IsolationResult[]>;
  getCompatibility(origin: Origin): Promise<CompatibilityReport>;
  installFailClosedStrip(tabId: TabId): Promise<IsolationResult>;
}
