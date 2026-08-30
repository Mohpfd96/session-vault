import { browser } from 'wxt/browser';
import type { NativeCookieInput } from '../../cookies/native-import.ts';

export async function getNativeCookiesForUrl(
  url: string,
): Promise<readonly NativeCookieInput[]> {
  const cookies = await browser.cookies.getAll({ url });
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    ...(cookie.hostOnly !== undefined ? { hostOnly: cookie.hostOnly } : {}),
    ...(cookie.httpOnly !== undefined ? { httpOnly: cookie.httpOnly } : {}),
    ...(cookie.secure !== undefined ? { secure: cookie.secure } : {}),
    ...(cookie.session !== undefined ? { session: cookie.session } : {}),
    ...(cookie.expirationDate !== undefined
      ? { expirationDate: cookie.expirationDate }
      : {}),
    ...(cookie.sameSite !== undefined ? { sameSite: cookie.sameSite } : {}),
    ...(cookie.partitionKey?.topLevelSite !== undefined
      ? { partitionKey: { topLevelSite: cookie.partitionKey.topLevelSite } }
      : {}),
  }));
}
