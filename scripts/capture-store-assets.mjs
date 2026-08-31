import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frames = path.join(root, 'scripts', 'store-assets', 'frames.html');
const outDir = path.join(root, 'assets', 'screenshots');

const shots = [
  { id: 'shot-1', file: 'Session Vault - screenshot 1.png', width: 1280, height: 800 },
  { id: 'shot-2', file: 'Session Vault - screenshot 2.png', width: 1280, height: 800 },
  { id: 'shot-3', file: 'Session Vault - screenshot 3.png', width: 1280, height: 800 },
  {
    id: 'tile-small',
    file: 'Session Vault - Small promo tile.png',
    width: 440,
    height: 280,
  },
  {
    id: 'tile-marquee',
    file: 'Session Vault - Marquee promo tile.png',
    width: 1400,
    height: 560,
  },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 1600, height: 1000 },
});

await page.goto(pathToFileURL(frames).href, { waitUntil: 'load' });
await page.waitForFunction(() =>
  [...document.images].every((image) => image.complete && image.naturalWidth > 0),
);

for (const shot of shots) {
  const locator = page.locator(`#${shot.id}`);
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`Missing frame #${shot.id}`);
  }
  if (box.width !== shot.width || box.height !== shot.height) {
    throw new Error(
      `#${shot.id} is ${box.width}×${box.height}, expected ${shot.width}×${shot.height}`,
    );
  }

  const dest = path.join(outDir, shot.file);
  await locator.screenshot({
    path: dest,
    type: 'png',
    animations: 'disabled',
    caret: 'hide',
  });
  console.log(`wrote ${shot.file} (${shot.width}×${shot.height})`);
}

await browser.close();
