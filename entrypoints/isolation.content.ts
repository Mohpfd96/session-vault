import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { injectScript } from 'wxt/utils/inject-script';
import { CHANNEL, type PageRequest, type Result } from '../modules/messaging/protocol.ts';
import { parsePageRequest } from '../modules/messaging/validate.ts';
import { installTabTitleMarker } from '../modules/tabs/tab-title-marker.ts';

const PAGE_RUNTIME_PATH = '/page-runtime.js' as const;

type PageEnvelope = {
  readonly channel: typeof CHANNEL.pageToContent;
  readonly requestId: string;
  readonly payload: PageRequest;
};

function isPageEnvelope(value: unknown): value is PageEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PageEnvelope).channel === CHANNEL.pageToContent &&
    typeof (value as PageEnvelope).requestId === 'string'
  );
}

async function sendContentRequest(payload: {
  type: string;
  origin: string;
  href: string;
  assignment?: string;
}): Promise<Result<unknown>> {
  const response: unknown = await browser.runtime.sendMessage(payload);
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    typeof (response as Result<unknown>).ok === 'boolean'
  ) {
    return response as Result<unknown>;
  }
  return {
    ok: false,
    code: 'ValidationFailed',
    message: 'Background returned an invalid envelope.',
    isolationSafe: true,
  };
}

async function performHelloHandshake(): Promise<void> {
  const origin = window.location.origin;
  const href = window.location.href;
  const response = await sendContentRequest({
    type: 'content.hello',
    origin,
    href,
  });

  if (!response.ok) {
    return;
  }

  const data = response.data;
  if (typeof data === 'object' && data !== null && 'tabMarker' in data) {
    const marker = (data as { tabMarker: unknown }).tabMarker;
    if (typeof marker === 'string' && marker.length > 0) {
      installTabTitleMarker(marker);
    }
  }

  const managed =
    typeof data === 'object' && data !== null && 'managed' in data
      ? Boolean((data as { managed: unknown }).managed)
      : false;
  const assignmentState =
    typeof data === 'object' &&
    data !== null &&
    'assignmentState' in data &&
    typeof (data as { assignmentState: unknown }).assignmentState === 'string'
      ? (data as { assignmentState: string }).assignmentState
      : 'none';

  window.postMessage(
    {
      channel: CHANNEL.contentToPage,
      type: 'hello',
      payload: {
        managed,
        assignmentState,
      },
    },
    window.location.origin,
  );
}

async function forwardPageRequest(envelope: PageEnvelope): Promise<void> {
  try {
    const payload = parsePageRequest(envelope.payload);
    const origin = window.location.origin;
    const href = window.location.href;

    let backgroundPayload: Record<string, unknown>;
    switch (payload.type) {
      case 'page.documentCookieGet':
        backgroundPayload = {
          type: 'content.documentCookieGet',
          origin,
          href,
        };
        break;
      case 'page.documentCookieSet':
        backgroundPayload = {
          type: 'content.documentCookieSet',
          origin,
          href,
          assignment: payload.assignment,
        };
        break;
      default: {
        const exhaustive: never = payload;
        throw new Error(`Unhandled page request: ${String(exhaustive)}`);
      }
    }

    const response = await sendContentRequest(
      backgroundPayload as {
        type: string;
        origin: string;
        href: string;
        assignment?: string;
      },
    );
    window.postMessage(
      {
        channel: CHANNEL.contentToPage,
        requestId: envelope.requestId,
        payload: response,
      },
      window.location.origin,
    );
  } catch (error) {
    window.postMessage(
      {
        channel: CHANNEL.contentToPage,
        requestId: envelope.requestId,
        payload: {
          ok: false,
          code: 'ValidationFailed',
          message: error instanceof Error ? error.message : 'Invalid page request.',
          isolationSafe: true,
        },
      },
      window.location.origin,
    );
  }
}

async function injectPageRuntime(): Promise<void> {
  try {
    await injectScript(PAGE_RUNTIME_PATH, { keepInDom: true });
    return;
  } catch {
    await new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = browser.runtime.getURL(PAGE_RUNTIME_PATH);
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      (document.head ?? document.documentElement).appendChild(script);
    });
  }
}

export default defineContentScript({
  matches: ['https://sessionvault.invalid/*'],
  runAt: 'document_start',
  registration: 'runtime',
  world: 'ISOLATED',
  main() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return;
      }
      if (isPageEnvelope(event.data)) {
        void forwardPageRequest(event.data);
      }
    });

    void (async () => {
      await injectPageRuntime();
      await performHelloHandshake();
    })();
  },
});
