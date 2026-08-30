import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

const isoDate = z.string().min(1);

export const sessionKindSchema = z.enum(['persistent', 'temporary']);
export const sessionStateSchema = z.enum([
  'creating',
  'ready',
  'active',
  'suspended',
  'archived',
  'deleting',
  'degraded',
  'locked',
  'corrupted',
  'migrating',
]);
export const sessionStrictnessSchema = z.enum(['compatibility', 'strict']);
export const temporaryCleanupSchema = z.enum([
  'last-tab',
  'browser-session',
  'grace-period',
]);
export const assignmentStateSchema = z.enum([
  'bound',
  'pending',
  'unassigned',
  'locked',
  'degraded',
]);
export const cookieSameSiteSchema = z.enum(['strict', 'lax', 'none', 'unspecified']);
export const cookieSourceSchema = z.enum(['http', 'document', 'import', 'migration']);

export const domainEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('exact-host'), host: z.string().min(1) }),
  z.object({
    type: z.literal('registrable-domain'),
    domain: z.string().min(1),
    includeSubdomains: z.boolean(),
  }),
  z.object({ type: z.literal('url-pattern'), pattern: z.string().min(1) }),
]);

export const sessionSettingsSchema = z.object({
  inheritToChildTabs: z.boolean(),
  tabGroupIntegration: z.boolean(),
  cloneSessionStorageOnDuplicate: z.boolean(),
  temporaryCleanup: temporaryCleanupSchema,
  gracePeriodMs: z.number().int().positive().optional(),
});

export const sessionProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  icon: z.string().min(1).max(32),
  kind: sessionKindSchema,
  state: sessionStateSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
  lastUsedAt: isoDate,
  pinned: z.boolean(),
  archived: z.boolean(),
  locked: z.boolean(),
  tags: z.array(z.string().max(32)).max(20),
  notes: z.string().max(4000),
  strictness: sessionStrictnessSchema,
  domainGroupIds: z.array(z.string().min(1)),
  settings: sessionSettingsSchema,
});

export const domainGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  domains: z.array(domainEntrySchema).min(1),
  includeSubdomains: z.boolean(),
  exclusions: z.array(domainEntrySchema),
  mode: z.enum(['managed', 'unmanaged']),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const tabBindingSchema = z.object({
  tabId: z.number().int(),
  sessionId: z.string().min(1),
  domainGroupId: z.string().min(1),
  assignmentState: assignmentStateSchema,
  createdAt: z.number(),
  lastVerifiedAt: z.number(),
});

export const virtualCookieSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  name: z.string().min(1),
  value: z.string(),
  domain: z.string().min(1),
  path: z.string().min(1),
  hostOnly: z.boolean(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  sameSite: cookieSameSiteSchema,
  expiresAt: z.number().optional(),
  sessionOnly: z.boolean(),
  creationTime: z.number(),
  lastUpdatedTime: z.number(),
  partitionKey: z.string().optional(),
  source: cookieSourceSchema,
});

export const schemaMetaSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  migratedAt: isoDate,
  lastBackupAt: isoDate.optional(),
});

export type SchemaMeta = z.infer<typeof schemaMetaSchema>;
