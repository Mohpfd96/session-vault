import { existsSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const extensionDir = path.resolve('.output/chrome-mv3');

test.describe('extension load smoke', () => {
  test.skip(
    !existsSync(extensionDir),
    'Extension build missing — run pnpm build before E2E. Alice/Bob isolation tests are not implemented yet.',
  );

  test('loads unpacked MV3 extension in Chromium', async ({ context }) => {
    // Cookie isolation E2E: start test-site (`node test-site/server.mjs`) and run Alice/Bob tab isolation when that spec exists.
    const page = await context.newPage();
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/i);
  });
});
