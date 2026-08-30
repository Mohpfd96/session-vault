import { describe, expect, it } from 'vitest';
import { redactFields, redactValue } from '../../../modules/logging/logger.ts';

describe('log redaction', () => {
  it('redacts sensitive keys', () => {
    expect(redactValue('cookie', 'alice-secret')).toBe('[redacted]');
    expect(redactValue('authorization', 'Bearer token')).toBe('[redacted]');
    expect(redactValue('sessionName', 'Work')).toBe('Work');
  });

  it('redacts fields objects', () => {
    const redacted = redactFields({
      cookieValue: 'alice-secret',
      tabId: 42,
      setCookie: 'session=alice-secret',
    });
    expect(redacted).toEqual({
      cookieValue: '[redacted]',
      tabId: 42,
      setCookie: '[redacted]',
    });
  });

  it('truncates very long strings on non-secret keys', () => {
    const long = 'x'.repeat(300);
    const result = redactValue('message', long);
    expect(typeof result).toBe('string');
    expect((result as string).endsWith('…[truncated]')).toBe(true);
  });
});
