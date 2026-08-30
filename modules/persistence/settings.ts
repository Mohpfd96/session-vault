import { z } from 'zod';
import { storageCorrupted } from '../errors/index.ts';
import { logger } from '../logging/index.ts';
import type { ChromeStorageLocalPort } from './ports/chrome-storage-local.ts';
import { STORAGE_KEYS } from './keys.ts';

export const appearanceSchema = z.enum(['system', 'light', 'dark']);

export const extensionSettingsSchema = z.object({
  appearance: appearanceSchema,
  diagnosticsEnabled: z.boolean(),
  developerMode: z.boolean(),
});

export type ExtensionSettings = z.infer<typeof extensionSettingsSchema>;

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  appearance: 'system',
  diagnosticsEnabled: false,
  developerMode: false,
};

export async function readSettings(
  port: ChromeStorageLocalPort,
): Promise<ExtensionSettings> {
  const raw = await port.get<unknown>(STORAGE_KEYS.settings);
  if (raw === undefined) {
    return { ...DEFAULT_EXTENSION_SETTINGS };
  }

  const parsed = extensionSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('Settings failed validation', {
      issues: parsed.error.issues.length,
    });
    throw storageCorrupted('Stored extension settings are invalid.');
  }

  return parsed.data;
}

export async function writeSettings(
  port: ChromeStorageLocalPort,
  settings: ExtensionSettings,
): Promise<void> {
  const validated = extensionSettingsSchema.parse(settings);
  await port.set(STORAGE_KEYS.settings, validated);
}
