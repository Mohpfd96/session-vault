import { browser } from 'wxt/browser';
import type { HttpHeader } from '../../cookies/ingest.ts';

export type HeadersReceivedDetails = {
  readonly tabId: number;
  readonly url: string;
  readonly responseHeaders: readonly HttpHeader[] | undefined;
};

export type HeadersReceivedSubscription = {
  readonly unsubscribe: () => void;
};

export function subscribeOnHeadersReceived(
  handler: (details: HeadersReceivedDetails) => void,
): HeadersReceivedSubscription {
  const listener = (details: {
    tabId: number;
    url: string;
    responseHeaders?: readonly HttpHeader[] | undefined;
  }): undefined => {
    handler({
      tabId: details.tabId,
      url: details.url,
      responseHeaders: details.responseHeaders,
    });
    return undefined;
  };

  browser.webRequest.onHeadersReceived.addListener(listener, { urls: ['<all_urls>'] }, [
    'responseHeaders',
    'extraHeaders',
  ]);

  return {
    unsubscribe: () => {
      browser.webRequest.onHeadersReceived.removeListener(listener);
    },
  };
}
