export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

const SECRET_KEY_PATTERN =
  /(cookie|token|password|authorization|secret|set-cookie|value|passphrase|key)/iu;

export function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string' && value.length > 256) {
    return `${value.slice(0, 24)}…[truncated]`;
  }
  return value;
}

export function redactFields(fields: LogFields | undefined): LogFields {
  if (fields === undefined) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const payload = { level, message, ...redactFields(fields) };
  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
  }
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    if (import.meta.env.DEV) {
      emit('debug', message, fields);
    }
  },
  info(message: string, fields?: LogFields): void {
    if (import.meta.env.DEV) {
      emit('info', message, fields);
    }
  },
  warn(message: string, fields?: LogFields): void {
    emit('warn', message, fields);
  },
  error(message: string, fields?: LogFields): void {
    emit('error', message, fields);
  },
};
