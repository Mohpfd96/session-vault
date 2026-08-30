import { describe, expect, it } from 'vitest';
import { redactFields, redactValue } from '../../../modules/logging/index.ts';

describe('redactFields', () => {
  it('never returns cookie values in output', () => {
    const redacted = redactFields({
      cookie: 'alice-secret',
      cookieValue: 'bob-secret',
      authorization: 'Bearer token-value',
      token: 'refresh-token',
      password: 'hunter2',
      secret: 'shh',
      nested: 'safe',
    });

    expect(redacted['cookie']).toBe('[redacted]');
    expect(redacted['cookieValue']).toBe('[redacted]');
    expect(redacted['authorization']).toBe('[redacted]');
    expect(redacted['token']).toBe('[redacted]');
    expect(redacted['password']).toBe('[redacted]');
    expect(redacted['secret']).toBe('[redacted]');
    expect(redacted['nested']).toBe('safe');
  });

  it('redacts individual sensitive keys via redactValue', () => {
    expect(redactValue('set-cookie', 'session=abc')).toBe('[redacted]');
    expect(redactValue('message', 'hello')).toBe('hello');
  });

  it('returns an empty object for undefined input', () => {
    expect(redactFields(undefined)).toEqual({});
  });
});
