import type { CookieSameSite } from '../domain/enums.ts';

export type ParsedSetCookie =
  | {
      readonly kind: 'set';
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
      readonly partitionKey?: string;
    }
  | {
      readonly kind: 'delete';
      readonly name: string;
      readonly domain: string;
      readonly path: string;
      readonly hostOnly: boolean;
      readonly partitionKey?: string;
    };

export type SetCookieParseContext = {
  readonly requestUrl: URL;
  readonly now: number;
};
