export function defaultCookiePath(requestUrl: URL): string {
  const pathname = requestUrl.pathname;
  if (pathname === '' || pathname === '/') {
    return '/';
  }

  const lastSlash = pathname.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '/';
  }

  return pathname.slice(0, lastSlash) || '/';
}

export function normalizeCookiePath(path: string | undefined, requestUrl: URL): string {
  if (path === undefined || path.length === 0) {
    return defaultCookiePath(requestUrl);
  }

  let normalized = path.trim();
  if (!normalized.startsWith('/')) {
    return '/';
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.length === 0 ? '/' : normalized;
}

export function pathMatches(cookiePath: string, requestPath: string): boolean {
  const normalizedCookiePath =
    cookiePath.length > 1 && cookiePath.endsWith('/')
      ? cookiePath.slice(0, -1)
      : cookiePath;
  const normalizedRequestPath =
    requestPath.length > 1 && requestPath.endsWith('/')
      ? requestPath.slice(0, -1)
      : requestPath;

  if (normalizedCookiePath === '/') {
    return true;
  }

  if (normalizedRequestPath === normalizedCookiePath) {
    return true;
  }

  return normalizedRequestPath.startsWith(`${normalizedCookiePath}/`);
}
