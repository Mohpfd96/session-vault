import { describe, expect, it } from 'vitest';
import {
  compileFailClosedRules,
  DNR_PRIORITIES,
  FAIL_CLOSED_RESOURCE_TYPES,
} from '../../../modules/isolation/rule-compiler.ts';

describe('compileFailClosedRules', () => {
  it('produces fail-closed strip rules with expected shape', () => {
    const rules = compileFailClosedRules(42, {
      failClosedStripId: 10,
      nativeSetCookieStripId: 11,
    });

    expect(rules).toHaveLength(2);

    const requestRule = rules[0];
    expect(requestRule?.id).toBe(10);
    expect(requestRule?.priority).toBe(DNR_PRIORITIES.FAIL_CLOSED_STRIP);
    expect(requestRule?.action).toEqual({
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Cookie', operation: 'remove' }],
    });
    expect(requestRule?.condition).toEqual({
      tabIds: [42],
      resourceTypes: [...FAIL_CLOSED_RESOURCE_TYPES],
    });

    const responseRule = rules[1];
    expect(responseRule?.id).toBe(11);
    expect(responseRule?.priority).toBe(DNR_PRIORITIES.NATIVE_SET_COOKIE_STRIP);
    expect(responseRule?.action).toEqual({
      type: 'modifyHeaders',
      responseHeaders: [{ header: 'Set-Cookie', operation: 'remove' }],
    });
  });
});
