export type DnrResourceType =
  'main_frame' | 'sub_frame' | 'xmlhttprequest' | 'websocket' | 'other';

export type DnrHeaderOperation = 'remove' | 'set' | 'append';

export type DnrHeaderModification = {
  readonly header: string;
  readonly operation: DnrHeaderOperation;
  readonly value?: string;
};

export type DnrSessionRule = {
  readonly id: number;
  readonly priority: number;
  readonly action: {
    readonly type: 'modifyHeaders';
    readonly requestHeaders?: readonly DnrHeaderModification[];
    readonly responseHeaders?: readonly DnrHeaderModification[];
  };
  readonly condition: {
    readonly tabIds: readonly number[];
    readonly resourceTypes: readonly DnrResourceType[];
    readonly requestDomains?: readonly string[];
    readonly urlFilter?: string;
  };
};

export type SessionRuleUpdate = {
  readonly removeRuleIds?: readonly number[];
  readonly addRules?: readonly DnrSessionRule[];
};

export type DnrLimits = {
  readonly maxSessionRules: number;
  readonly maxUnsafeSessionRules: number;
};
