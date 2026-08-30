import { browser } from 'wxt/browser';
import type { Result, UiRequest } from '@/modules/messaging/protocol.ts';

export async function sendUiMessage<T>(request: UiRequest): Promise<Result<T>> {
  try {
    const response: unknown = await browser.runtime.sendMessage(request);
    if (response === undefined) {
      return {
        ok: false,
        code: 'NO_RESPONSE',
        message: 'Extension background is not available.',
        isolationSafe: true,
      };
    }
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
      code: 'INVALID_RESPONSE',
      message: 'Received an unexpected response from the extension background.',
      isolationSafe: true,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to connect to the extension background.';
    return {
      ok: false,
      code: 'CONNECTION_ERROR',
      message,
      isolationSafe: true,
    };
  }
}
