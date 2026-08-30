import type { Brand } from '../brand.ts';

export type SessionId = Brand<string, 'SessionId'>;
export type DomainGroupId = Brand<string, 'DomainGroupId'>;
export type CookieId = Brand<string, 'CookieId'>;
export type RoutingRuleId = Brand<string, 'RoutingRuleId'>;
export type TabId = Brand<number, 'TabId'>;
export type Origin = Brand<string, 'Origin'>;

export function asSessionId(value: string): SessionId {
  return value as SessionId;
}

export function asDomainGroupId(value: string): DomainGroupId {
  return value as DomainGroupId;
}

export function asCookieId(value: string): CookieId {
  return value as CookieId;
}

export function asRoutingRuleId(value: string): RoutingRuleId {
  return value as RoutingRuleId;
}

export function asTabId(value: number): TabId {
  return value as TabId;
}

export function asOrigin(value: string): Origin {
  return value as Origin;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
