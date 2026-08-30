export type HeaderOperation = 'append' | 'set' | 'remove';

export type ModifyHeaderInfo = {
  readonly header: string;
  readonly operation: HeaderOperation;
  readonly value?: string;
};

export type ResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle'
  | 'other';

export type RuleCondition = {
  readonly tabIds?: readonly number[];
  readonly urlFilter?: string;
  readonly requestDomains?: readonly string[];
  readonly resourceTypes?: readonly ResourceType[];
};

export type RuleAction =
  | {
      readonly type: 'modifyHeaders';
      readonly requestHeaders?: readonly ModifyHeaderInfo[];
      readonly responseHeaders?: readonly ModifyHeaderInfo[];
    }
  | {
      readonly type:
        'allow' | 'allowAllRequests' | 'block' | 'upgradeScheme' | 'redirect';
    };

export type DnrRule = {
  readonly id: number;
  readonly priority: number;
  readonly condition: RuleCondition;
  readonly action: RuleAction;
};

export type RuleIdAllocator = {
  readonly nextId: () => number;
};

export function createSequentialAllocator(start = 1): RuleIdAllocator {
  let current = start;
  return {
    nextId(): number {
      const id = current;
      current += 1;
      return id;
    },
  };
}
