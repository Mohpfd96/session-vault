import { logger } from '../../logging/index.ts';
import { browser } from 'wxt/browser';
import type { TabId } from '../../domain/ids.ts';

export type ToolbarIconVariant = 'idle' | 'active';

const ICON_PATH: Record<ToolbarIconVariant, string> = {
  idle: 'icon.svg',
  active: 'icon-filled.svg',
};

const imageDataCache = new Map<ToolbarIconVariant, Record<string, ImageData>>();

function roundRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Path2D {
  const path = new Path2D();
  path.moveTo(x + radius, y);
  path.arcTo(x + width, y, x + width, y + height, radius);
  path.arcTo(x + width, y + height, x, y + height, radius);
  path.arcTo(x, y + height, x, y, radius);
  path.arcTo(x, y, x + width, y, radius);
  path.closePath();
  return path;
}

function paintToolbarIcon(
  ctx: OffscreenCanvasRenderingContext2D,
  filled: boolean,
): void {
  ctx.clearRect(0, 0, 128, 128);
  const frame = roundRectPath(8, 8, 112, 112, 22);
  if (filled) {
    ctx.fillStyle = '#0f766e';
    ctx.fill(frame);
  } else {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 8;
    ctx.stroke(frame);
  }

  ctx.fillStyle = filled ? '#ecfeff' : '#0f766e';
  ctx.fill(new Path2D('M36 44h56v12H56v40H44V56H36V44z'));

  ctx.beginPath();
  ctx.arc(88, 88, 14, 0, Math.PI * 2);
  if (filled) {
    ctx.fillStyle = '#5eead4';
    ctx.fill();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 4;
  }
  ctx.beginPath();
  ctx.moveTo(82, 88);
  ctx.lineTo(94, 88);
  ctx.moveTo(88, 82);
  ctx.lineTo(88, 94);
  ctx.lineCap = 'round';
  ctx.stroke();
}

function renderToolbarIcon(size: number, filled: boolean): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('OffscreenCanvas 2d context is unavailable.');
  }
  ctx.scale(size / 128, size / 128);
  paintToolbarIcon(ctx, filled);
  return ctx.getImageData(0, 0, size, size);
}

function iconImageData(filled: boolean): Record<string, ImageData> {
  const variant: ToolbarIconVariant = filled ? 'active' : 'idle';
  const cached = imageDataCache.get(variant);
  if (cached !== undefined) {
    return cached;
  }
  const data = {
    '16': renderToolbarIcon(16, filled),
    '32': renderToolbarIcon(32, filled),
  };
  imageDataCache.set(variant, data);
  return data;
}

async function applyIcon(tabId: TabId, variant: ToolbarIconVariant): Promise<void> {
  const filled = variant === 'active';
  try {
    await browser.action.setIcon({
      tabId,
      imageData: iconImageData(filled),
    });
    return;
  } catch (error) {
    logger.warn('Toolbar ImageData icon failed; using file path', {
      tabId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
  await browser.action.setIcon({
    tabId,
    path: ICON_PATH[variant],
  });
}

export async function setToolbarIcon(
  tabId: TabId,
  variant: ToolbarIconVariant,
): Promise<void> {
  try {
    await applyIcon(tabId, variant);
    await browser.action.setTitle({
      tabId,
      title: variant === 'active' ? 'Session Vault · Isolated session' : 'Session Vault',
    });
  } catch (error) {
    logger.warn('Failed to set toolbar icon', {
      tabId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
