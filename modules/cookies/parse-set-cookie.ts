import type { CookieSameSite } from '../domain/enums.ts';
import { validateSetCookieDomain } from './domain.ts';
import { defaultCookiePath, normalizeCookiePath } from './path.ts';
import type { ParsedSetCookie } from './types.ts';

const KNOWN_ATTRIBUTES = new Set([
  'expires',
  'max-age',
  'domain',
  'path',
  'secure',
  'httponly',
  'samesite',
  'partitioned',
]);

type AttributeMap = {
  expires?: string;
  maxAge?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  partitioned?: boolean;
};

function parseNameValuePair(segment: string): { name: string; value: string } | null {
  const trimmed = segment.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const name = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }

  if (name.length === 0) {
    return null;
  }

  return { name, value };
}

function parseAttributes(segments: readonly string[]): AttributeMap {
  const attributes: AttributeMap = {};

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    const rawName = equalsIndex === -1 ? trimmed : trimmed.slice(0, equalsIndex);
    const name = rawName.trim().toLowerCase();

    if (!KNOWN_ATTRIBUTES.has(name)) {
      continue;
    }

    if (name === 'secure') {
      attributes.secure = true;
      continue;
    }
    if (name === 'httponly') {
      attributes.httpOnly = true;
      continue;
    }
    if (name === 'partitioned') {
      attributes.partitioned = true;
      continue;
    }

    if (equalsIndex === -1) {
      continue;
    }

    const value = trimmed.slice(equalsIndex + 1).trim();
    if (name === 'expires') {
      attributes.expires = value;
    } else if (name === 'max-age') {
      attributes.maxAge = value;
    } else if (name === 'domain') {
      attributes.domain = value;
    } else if (name === 'path') {
      attributes.path = value;
    } else if (name === 'samesite') {
      attributes.sameSite = value;
    }
  }

  return attributes;
}

function parseExpires(value: string): number | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function parseMaxAge(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function parseSameSite(value: string | undefined): CookieSameSite {
  if (value === undefined) {
    return 'unspecified';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'strict') {
    return 'strict';
  }
  if (normalized === 'lax') {
    return 'lax';
  }
  if (normalized === 'none') {
    return 'none';
  }
  return 'unspecified';
}

function computeExpiry(
  attributes: AttributeMap,
  now: number,
): { expiresAt?: number; sessionOnly: boolean; delete: boolean } {
  if (attributes.maxAge !== undefined) {
    const maxAge = parseMaxAge(attributes.maxAge);
    if (maxAge === null) {
      return { sessionOnly: true, delete: false };
    }
    if (maxAge <= 0) {
      return { sessionOnly: true, delete: true };
    }
    return {
      expiresAt: now + maxAge * 1000,
      sessionOnly: false,
      delete: false,
    };
  }

  if (attributes.expires !== undefined) {
    const expiresAt = parseExpires(attributes.expires);
    if (expiresAt === null) {
      return { sessionOnly: true, delete: false };
    }
    if (expiresAt <= now) {
      return { sessionOnly: false, delete: true, expiresAt };
    }
    return { expiresAt, sessionOnly: false, delete: false };
  }

  return { sessionOnly: true, delete: false };
}

export function parseSetCookie(
  header: string,
  requestUrl: URL,
  now: number,
): ParsedSetCookie | null {
  const segments = header.split(';');
  const first = segments[0];
  if (first === undefined) {
    return null;
  }

  const pair = parseNameValuePair(first);
  if (pair === null) {
    return null;
  }

  const attributes = parseAttributes(segments.slice(1));
  const domainResult = validateSetCookieDomain(attributes.domain, requestUrl.hostname);
  if (domainResult === null) {
    return null;
  }

  const path = normalizeCookiePath(attributes.path, requestUrl);
  const secure = attributes.secure === true;
  if (secure && requestUrl.protocol !== 'https:') {
    return null;
  }

  const expiry = computeExpiry(attributes, now);
  const partitionKey = attributes.partitioned === true ? 'partitioned' : undefined;

  if (expiry.delete) {
    const result: ParsedSetCookie = {
      kind: 'delete',
      name: pair.name,
      domain: domainResult.domain,
      path,
      hostOnly: domainResult.hostOnly,
    };
    if (partitionKey !== undefined) {
      return { ...result, partitionKey };
    }
    return result;
  }

  const setResult: ParsedSetCookie = {
    kind: 'set',
    name: pair.name,
    value: pair.value,
    domain: domainResult.domain,
    path,
    hostOnly: domainResult.hostOnly,
    secure,
    httpOnly: attributes.httpOnly === true,
    sameSite: parseSameSite(attributes.sameSite),
    sessionOnly: expiry.sessionOnly,
    ...(expiry.expiresAt !== undefined ? { expiresAt: expiry.expiresAt } : {}),
    ...(partitionKey !== undefined ? { partitionKey } : {}),
  };

  return setResult;
}

export function defaultPathForRequest(requestUrl: URL): string {
  return defaultCookiePath(requestUrl);
}
