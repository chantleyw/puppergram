/**
 * Rasterises public/favicon.svg into the PWA icon set.
 *
 * The maskable variant re-draws the mark at 60% inside a full-bleed
 * background, because Android crops maskable icons to a circle and a
 * corner-to-corner logo loses its paw to the crop.
 *
 *   node scripts/icons.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'public/favicon.svg';
const OUT = 'public/icons';
const BG = '#171019';

const svg = await readFile(SRC, 'utf8');
await mkdir(OUT, { recursive: true });

/** Square icon, logo edge to edge. */
async function plain(size, name) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`${OUT}/${name}`);
  console.log(`  ${name}  ${size}x${size}`);
}

/** Maskable: same mark, inset into the safe zone. */
async function maskable(size, name) {
  const inner = Math.round(size * 0.6);
  const pad = Math.round((size - inner) / 2);

  // Drop the rounded background from the source; the flat one behind it wins.
  const markOnly = svg.replace(/<rect[^>]*rx="14"[^>]*\/>/, '');

  const mark = await sharp(Buffer.from(markOnly), { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toFile(`${OUT}/${name}`);
  console.log(`  ${name}  ${size}x${size} (maskable, ${inner}px safe zone)`);
}

console.log('Generating icons from', SRC);
await plain(192, 'icon-192.png');
await plain(512, 'icon-512.png');
await maskable(512, 'icon-512-maskable.png');

// Apple touch icons must not be transparent, and iOS applies its own mask.
await plain(180, 'apple-touch-icon.png');

// Source for `npx tauri icon`, which wants a large square PNG.
await writeFile(`${OUT}/.gitkeep`, '');
console.log('Done.');
