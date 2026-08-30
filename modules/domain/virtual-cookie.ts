import type { CookieId, SessionId } from './ids.ts';
import type { CookieSameSite, CookieSource } from './enums.ts';

export type VirtualCookie = {
  readonly id: CookieId;
  readonly sessionId: SessionId;
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly hostOnly: boolean;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  readonly sameSite: CookieSameSite;
  readonly expiresAt?: number;
  readonly sessionOnly: boolean;
  readonly creationTime: number;
  readonly lastUpdatedTime: number;
  readonly partitionKey?: string;
  readonly source: CookieSource;
};

export type CookieIdentity = {
  readonly sessionId: SessionId;
  readonly name: string;
  readonly domain: string;
  readonly path: string;
  readonly partitionKey?: string;
};
