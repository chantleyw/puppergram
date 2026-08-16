/**
 * Generates the PWA icon set. Run with `node scripts/generate-icons.mjs`.
 *
 * Hand-rolled PNG encoding rather than a dependency: the mark is a few
 * rectangles, and this keeps the install footprint of a weight-logging app
 * from including an image toolchain.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const INK = [0x14, 0x10, 0x0e];
const HEAT = [0xf2, 0xa6, 0x5a];
const CREAM = [0xed, 0xe3, 0xd8];

/* ---------- minimal PNG writer ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[o++] = rgb[i];
      raw[o++] = rgb[i + 1];
      raw[o++] = rgb[i + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- the mark ---------- */

function draw(size, { maskable }) {
  const rgb = new Uint8Array(size * size * 3);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    rgb[i] = c[0];
    rgb[i + 1] = c[1];
    rgb[i + 2] = c[2];
  };
  const rect = (x0, y0, w, h, c, radius = 0) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (radius > 0) {
          const dx = Math.min(x - x0, x0 + w - 1 - x);
          const dy = Math.min(y - y0, y0 + h - 1 - y);
          if (dx < radius && dy < radius) {
            const ddx = radius - dx;
            const ddy = radius - dy;
            if (ddx * ddx + ddy * ddy > radius * radius) continue;
          }
        }
        put(x, y, c);
      }
    }
  };

  rect(0, 0, size, size, INK);

  // Maskable icons get a safe zone: keep the mark inside the middle 80%.
  const pad = maskable ? size * 0.22 : size * 0.16;
  const inner = size - pad * 2;

  // The collar spine, on the left, in heat amber.
  const spineW = Math.round(inner * 0.13);
  rect(
    Math.round(pad),
    Math.round(pad),
    spineW,
    Math.round(inner),
    HEAT,
    Math.round(spineW / 2)
  );

  // Three rising bars: gram by gram, day by day.
  const gap = Math.round(inner * 0.07);
  const barW = Math.round(inner * 0.17);
  const startX = Math.round(pad + spineW + gap * 1.6);
  const heights = [0.42, 0.66, 0.95];
  for (const [i, hFrac] of heights.entries()) {
    const h = Math.round(inner * hFrac);
    const x = startX + i * (barW + gap);
    const y = Math.round(pad + inner - h);
    rect(x, y, barW, h, CREAM, Math.round(barW / 3));
  }

  return encodePng(size, size, rgb);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon-192.png'), draw(192, { maskable: false }));
writeFileSync(join(OUT, 'icon-512.png'), draw(512, { maskable: false }));
writeFileSync(join(OUT, 'icon-512-maskable.png'), draw(512, { maskable: true }));
console.log('Wrote icon-192.png, icon-512.png, icon-512-maskable.png to public/icons');
