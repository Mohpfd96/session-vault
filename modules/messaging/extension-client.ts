import { browser } from 'wxt/browser';
import type { Result, UiRequest } from './protocol.ts';

export async function sendUiRequest<T>(request: UiRequest): Promise<Result<T>> {
  const response: unknown = await browser.runtime.sendMessage(request);
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    typeof (response as Result<T>).ok === 'boolean'
  ) {
    return response as Result<T>;
  }
  return {
    ok: false,
    code: 'ValidationFailed',
    message: 'Background did not return a valid result envelope.',
    isolationSafe: true,
  };
}

export async function pingBackground(): Promise<Result<{ pong: true }>> {
  return sendUiRequest({ type: 'ui.ping' });
}
