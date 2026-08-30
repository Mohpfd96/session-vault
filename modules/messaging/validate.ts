import { z } from 'zod';
import {
  contentRequestSchema,
  pageRequestSchema,
  uiRequestSchema,
  type ContentRequest,
  type PageRequest,
  type UiRequest,
} from './protocol.ts';
import { validationFailed } from '../errors/index.ts';

const strictPageRequestSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('page.documentCookieGet'),
    })
    .strict(),
  z
    .object({
      type: z.literal('page.documentCookieSet'),
      assignment: z.string().max(8192),
    })
    .strict(),
]);

export function parseUiRequest(raw: unknown): UiRequest {
  const parsed = uiRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed(`Invalid UI request: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function parseContentRequest(
  raw: unknown,
  senderTabUrl: string | undefined,
): ContentRequest {
  const parsed = contentRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed(`Invalid content request: ${parsed.error.message}`);
  }

  if (senderTabUrl === undefined) {
    throw validationFailed('Content request missing sender tab URL.');
  }

  let senderOrigin: string;
  try {
    senderOrigin = new URL(senderTabUrl).origin;
  } catch {
    throw validationFailed('Content request sender tab URL is invalid.');
  }

  if (parsed.data.origin !== senderOrigin) {
    throw validationFailed('Content request origin does not match sender tab.');
  }

  return parsed.data;
}

export function parsePageRequest(raw: unknown): PageRequest {
  if (typeof raw !== 'object' || raw === null) {
    throw validationFailed('Page request must be an object.');
  }

  if ('sessionId' in raw) {
    throw validationFailed('Page requests must not include sessionId.');
  }

  const parsed = strictPageRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fallback = pageRequestSchema.safeParse(raw);
    if (!fallback.success) {
      throw validationFailed(`Invalid page request: ${parsed.error.message}`);
    }
    return fallback.data;
  }

  return parsed.data;
}

export function originFromUrl(url: string): string {
  return new URL(url).origin;
}
