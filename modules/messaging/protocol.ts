import { CHANNEL } from './channels.ts';
import { z } from 'zod';

export { CHANNEL };

export const uiRequestTypeSchema = z.enum([
  'ui.ping',
  'ui.getPopupSnapshot',
  'ui.getSidePanelSnapshot',
  'ui.listSessions',
  'ui.createSession',
  'ui.createTemporarySession',
  'ui.switchTabSession',
  'ui.duplicateIntoSession',
  'ui.moveTabToSession',
  'ui.openSidePanel',
  'ui.enableIsolationForTab',
  'ui.deleteSession',
  'ui.renameSession',
  'ui.openSession',
]);

export const contentRequestTypeSchema = z.enum([
  'content.hello',
  'content.documentCookieGet',
  'content.documentCookieSet',
  'content.storageOp',
]);

export const createSessionRequestSchema = z.object({
  type: z.literal('ui.createSession'),
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(32).optional(),
  icon: z.string().min(1).max(32).optional(),
  kind: z.enum(['persistent', 'temporary']).optional(),
  attachToActiveTab: z.boolean().optional(),
});

export const switchTabSessionRequestSchema = z.object({
  type: z.literal('ui.switchTabSession'),
  sessionId: z.string().min(1),
});

export const pingRequestSchema = z.object({
  type: z.literal('ui.ping'),
});

export const getPopupSnapshotRequestSchema = z.object({
  type: z.literal('ui.getPopupSnapshot'),
});

export const getSidePanelSnapshotRequestSchema = z.object({
  type: z.literal('ui.getSidePanelSnapshot'),
});

export const listSessionsRequestSchema = z.object({
  type: z.literal('ui.listSessions'),
});

export const createTemporarySessionRequestSchema = z.object({
  type: z.literal('ui.createTemporarySession'),
});

export const duplicateIntoSessionRequestSchema = z.object({
  type: z.literal('ui.duplicateIntoSession'),
  sessionId: z.string().min(1),
});

export const moveTabToSessionRequestSchema = z.object({
  type: z.literal('ui.moveTabToSession'),
  sessionId: z.string().min(1),
});

export const openSidePanelRequestSchema = z.object({
  type: z.literal('ui.openSidePanel'),
});

export const enableIsolationForTabRequestSchema = z.object({
  type: z.literal('ui.enableIsolationForTab'),
});

export const deleteSessionRequestSchema = z.object({
  type: z.literal('ui.deleteSession'),
  sessionId: z.string().min(1),
});

export const renameSessionRequestSchema = z.object({
  type: z.literal('ui.renameSession'),
  sessionId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export const openSessionRequestSchema = z.object({
  type: z.literal('ui.openSession'),
  sessionId: z.string().min(1),
});

export const uiRequestSchema = z.discriminatedUnion('type', [
  pingRequestSchema,
  getPopupSnapshotRequestSchema,
  getSidePanelSnapshotRequestSchema,
  listSessionsRequestSchema,
  createSessionRequestSchema,
  createTemporarySessionRequestSchema,
  switchTabSessionRequestSchema,
  duplicateIntoSessionRequestSchema,
  moveTabToSessionRequestSchema,
  openSidePanelRequestSchema,
  enableIsolationForTabRequestSchema,
  deleteSessionRequestSchema,
  renameSessionRequestSchema,
  openSessionRequestSchema,
]);

export type UiRequest = z.infer<typeof uiRequestSchema>;

export const contentHelloSchema = z.object({
  type: z.literal('content.hello'),
  origin: z.string().min(1),
  href: z.string().min(1),
});

export const documentCookieGetSchema = z.object({
  type: z.literal('content.documentCookieGet'),
  origin: z.string().min(1),
  href: z.string().min(1),
});

export const documentCookieSetSchema = z.object({
  type: z.literal('content.documentCookieSet'),
  origin: z.string().min(1),
  href: z.string().min(1),
  assignment: z.string().max(8192),
});

export const storageOpSchema = z.object({
  type: z.literal('content.storageOp'),
  origin: z.string().min(1),
  href: z.string().min(1),
  kind: z.enum(['local']),
  op: z.enum(['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length', 'keys']),
  key: z.string().max(2048).optional(),
  value: z.string().max(5_000_000).optional(),
  index: z.number().int().nonnegative().optional(),
});

export const contentRequestSchema = z.discriminatedUnion('type', [
  contentHelloSchema,
  documentCookieGetSchema,
  documentCookieSetSchema,
  storageOpSchema,
]);

export type ContentRequest = z.infer<typeof contentRequestSchema>;

export const pageCookieGetSchema = z.object({
  type: z.literal('page.documentCookieGet'),
});

export const pageCookieSetSchema = z.object({
  type: z.literal('page.documentCookieSet'),
  assignment: z.string().max(8192),
});

export const pageRequestSchema = z.discriminatedUnion('type', [
  pageCookieGetSchema,
  pageCookieSetSchema,
]);

export type PageRequest = z.infer<typeof pageRequestSchema>;

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly isolationSafe: boolean;
    };
