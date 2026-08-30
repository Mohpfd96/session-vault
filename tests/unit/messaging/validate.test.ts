import { describe, expect, it } from 'vitest';
import {
  parseContentRequest,
  parsePageRequest,
  parseUiRequest,
} from '../../../modules/messaging/validate.ts';

describe('parsePageRequest', () => {
  it('rejects forged sessionId fields', () => {
    expect(() =>
      parsePageRequest({
        type: 'page.documentCookieGet',
        sessionId: 'ses_evil',
      }),
    ).toThrowError(/sessionId/u);
  });

  it('accepts valid cookie get requests', () => {
    expect(parsePageRequest({ type: 'page.documentCookieGet' })).toEqual({
      type: 'page.documentCookieGet',
    });
  });
});

describe('parseContentRequest', () => {
  it('rejects origin mismatch with sender tab', () => {
    expect(() =>
      parseContentRequest(
        {
          type: 'content.hello',
          origin: 'https://evil.example',
          href: 'https://evil.example/path',
        },
        'https://real.example/page',
      ),
    ).toThrowError(/origin/u);
  });

  it('accepts matching origin', () => {
    const request = parseContentRequest(
      {
        type: 'content.hello',
        origin: 'https://example.com',
        href: 'https://example.com/path',
      },
      'https://example.com/page',
    );
    expect(request.type).toBe('content.hello');
  });
});

describe('parseUiRequest', () => {
  it('rejects unknown ui message types', () => {
    expect(() =>
      parseUiRequest({
        type: 'ui.hack',
      }),
    ).toThrow();
  });

  it('accepts create, delete, and rename session requests', () => {
    expect(
      parseUiRequest({
        type: 'ui.createSession',
        name: 'Work',
        attachToActiveTab: true,
      }),
    ).toMatchObject({
      type: 'ui.createSession',
      name: 'Work',
      attachToActiveTab: true,
    });
    expect(
      parseUiRequest({
        type: 'ui.deleteSession',
        sessionId: 'ses_1',
      }),
    ).toEqual({
      type: 'ui.deleteSession',
      sessionId: 'ses_1',
    });
    expect(
      parseUiRequest({
        type: 'ui.renameSession',
        sessionId: 'ses_1',
        name: 'Personal',
      }),
    ).toEqual({
      type: 'ui.renameSession',
      sessionId: 'ses_1',
      name: 'Personal',
    });
    expect(
      parseUiRequest({
        type: 'ui.openSession',
        sessionId: 'ses_1',
      }),
    ).toEqual({
      type: 'ui.openSession',
      sessionId: 'ses_1',
    });
  });
});
