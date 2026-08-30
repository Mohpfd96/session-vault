import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { CHANNEL } from '../modules/messaging/channels.ts';

type PageRequest =
  | { readonly type: 'page.documentCookieGet' }
  | { readonly type: 'page.documentCookieSet'; readonly assignment: string };

let managed = false;
let handshakeOk = false;
let proxyInstalled = false;
let cachedCookie = '';

function postPageRequest(payload: PageRequest): Promise<unknown> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onResponse);
      resolve(undefined);
    }, 5_000);

    const onResponse = (event: MessageEvent): void => {
      const data = event.data as { channel?: string; requestId?: string; payload?: unknown };
      if (event.source !== window || data.channel !== CHANNEL.contentToPage) {
        return;
      }
      if (data.requestId !== requestId) {
        return;
      }
      window.removeEventListener('message', onResponse);
      window.clearTimeout(timeout);
      resolve(data.payload);
    };

    window.addEventListener('message', onResponse);
    window.postMessage(
      {
        channel: CHANNEL.pageToContent,
        requestId,
        payload,
      },
      window.location.origin,
    );
  });
}

function cookieValueFromPayload(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'ok' in payload &&
    (payload as { ok: unknown }).ok === true &&
    'data' in payload
  ) {
    const data = (payload as { data: unknown }).data;
    if (typeof data === 'object' && data !== null && 'value' in data) {
      const value = (data as { value: unknown }).value;
      return typeof value === 'string' ? value : '';
    }
  }
  return '';
}

async function pullCookies(): Promise<void> {
  const payload = await postPageRequest({ type: 'page.documentCookieGet' });
  cachedCookie = cookieValueFromPayload(payload);
}

function installCookieProxy(): void {
  if (proxyInstalled) {
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (descriptor === undefined) {
    return;
  }

  proxyInstalled = true;
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    enumerable: descriptor.enumerable ?? false,
    get(): string {
      if (!handshakeOk) {
        return '';
      }
      if (!managed) {
        return typeof descriptor.get === 'function' ? descriptor.get.call(document) : '';
      }
      return cachedCookie;
    },
    set(assignment: string): void {
      if (!handshakeOk) {
        return;
      }
      if (!managed) {
        if (typeof descriptor.set === 'function') {
          descriptor.set.call(document, assignment);
        }
        return;
      }
      void postPageRequest({
        type: 'page.documentCookieSet',
        assignment,
      }).then(() => pullCookies());
    },
  });
}

export default defineUnlistedScript(() => {
  installCookieProxy();

  window.addEventListener('message', (event) => {
    const data = event.data as {
      channel?: string;
      type?: string;
      payload?: { managed?: boolean };
    };
    if (event.source !== window || data.channel !== CHANNEL.contentToPage) {
      return;
    }
    if (data.type === 'hello') {
      managed = data.payload?.managed === true;
      handshakeOk = true;
      if (managed) {
        void pullCookies();
      }
    }
  });
});
