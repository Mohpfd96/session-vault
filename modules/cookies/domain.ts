import { getDomain, parse as parseHost } from 'tldts';

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/u, '');
}

export function isIpHost(host: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/u.test(host) || host.includes(':');
}

export function isPublicSuffix(domain: string): boolean {
  const normalized = normalizeHost(domain);
  if (normalized.length === 0 || isIpHost(normalized)) {
    return false;
  }
  const parsed = parseHost(normalized, { allowPrivateDomains: true });
  if (parsed.domain === null || parsed.publicSuffix === null) {
    return true;
  }
  return normalized === parsed.publicSuffix;
}

export function registrableDomain(host: string): string | null {
  const normalized = normalizeHost(host);
  if (isIpHost(normalized)) {
    return normalized;
  }
  return getDomain(normalized, { allowPrivateDomains: true });
}

export function isHostSuffixOf(candidate: string, host: string): boolean {
  const normalizedCandidate = normalizeHost(candidate);
  const normalizedHost = normalizeHost(host);
  if (normalizedCandidate === normalizedHost) {
    return true;
  }
  return normalizedHost.endsWith(`.${normalizedCandidate}`);
}

export function domainMatches(
  cookieDomain: string,
  hostOnly: boolean,
  requestHost: string,
): boolean {
  const host = normalizeHost(requestHost);
  const domain = normalizeHost(cookieDomain);

  if (hostOnly) {
    return host === domain;
  }

  return host === domain || host.endsWith(`.${domain}`);
}

export function validateSetCookieDomain(
  requestedDomain: string | undefined,
  requestHost: string,
): { domain: string; hostOnly: boolean } | null {
  const host = normalizeHost(requestHost);

  if (requestedDomain === undefined) {
    return { domain: host, hostOnly: true };
  }

  const domain = normalizeHost(requestedDomain);
  if (domain.length === 0 || domain.startsWith('.')) {
    return null;
  }
  if (isPublicSuffix(domain)) {
    return null;
  }
  if (!isHostSuffixOf(domain, host)) {
    return null;
  }

  return { domain, hostOnly: false };
}
