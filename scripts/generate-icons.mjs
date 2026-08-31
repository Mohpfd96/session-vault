import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TEAL = [15, 118, 110, 255];
const ICE = [236, 254, 255, 255];
const MINT = [94, 234, 212, 255];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i += 1) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= width) {
    return;
  }
  const i = (y * width + x) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = color[3];
}

function inRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  if (cx === x || cy === y) {
    return true;
  }
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inCircle(x, y, cx, cy, radius) {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inKeyShape(x, y) {
  return (
    (x >= 36 && x < 92 && y >= 44 && y < 56) || (x >= 44 && x < 56 && y >= 56 && y < 96)
  );
}

function inPlus(x, y) {
  const dx = Math.abs(x + 0.5 - 88);
  const dy = Math.abs(y + 0.5 - 88);
  return (dx <= 6 && dy <= 1.6) || (dy <= 6 && dx <= 1.6);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 128;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = (px + 0.5) / scale;
      const y = (py + 0.5) / scale;
      let color = TEAL;
      if (!inRoundedRect(x, y, 0, 0, 128, 128, 24)) {
        color = [0, 0, 0, 0];
      } else if (inKeyShape(x, y)) {
        color = ICE;
      } else if (inCircle(x, y, 88, 88, 14)) {
        color = inPlus(x, y) ? TEAL : MINT;
      }
      setPixel(rgba, size, px, py, color);
    }
  }
  return encodePng(size, size, rgba);
}

const sizes = [16, 32, 48, 128];
const publicDir = path.join(root, 'public');
mkdirSync(publicDir, { recursive: true });
for (const size of sizes) {
  const file = path.join(publicDir, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
}
writeFileSync(path.join(root, 'site', 'icon-128.png'), renderIcon(128));
console.log('Wrote icon-16.png, icon-32.png, icon-48.png, icon-128.png');
