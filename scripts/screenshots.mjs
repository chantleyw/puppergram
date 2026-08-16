/**
 * Captures the README screenshots against a running Puppergram.
 *
 * Drives the installed Edge via playwright-core, so nothing has to be
 * downloaded. Loads the demo litter first, so every shot shows the day-six
 * litter with Green already in trouble.
 *
 *   node scripts/screenshots.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'https://puppergram.pages.dev';
const OUT = 'docs/screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });

async function newCtx(width, height, mobile = false) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // retina-crisp in the README
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: 'dark',
    reducedMotion: 'reduce', // no half-played animations in a still
  });
  return ctx;
}

/** Clicks through the empty state so the demo litter exists. */
async function seed(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const load = page.getByRole('button', { name: /load demo litter/i });
  if (await load.isVisible().catch(() => false)) {
    await load.click();
    await page.waitForTimeout(1200);
  }
}

/* ---------------- desktop: alert + matrix ---------------- */
{
  const ctx = await newCtx(1280, 900);
  const page = await ctx.newPage();
  await seed(page);
  await page.waitForTimeout(600);

  await page.screenshot({ path: `${OUT}/alert.png` });
  console.log('  alert.png');

  // Target the matrix by its heading — `table` also matches the collapsed
  // rules table, which is not visible and cannot be screenshotted.
  const matrixCard = page
    .locator('div.card')
    .filter({ hasText: 'Litter matrix' })
    .first();
  await matrixCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await matrixCard.screenshot({ path: `${OUT}/matrix.png` });
  console.log('  matrix.png');

  await page.goto(`${BASE}/verify`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/verify.png` });
  console.log('  verify.png');

  await ctx.close();
}

/* ---------------- phone: weigh flow ---------------- */
{
  const ctx = await newCtx(390, 844, true);
  const page = await ctx.newPage();
  await seed(page);

  await page.goto(`${BASE}/weigh`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Put a weight on the display so the screen isn't showing an empty dash.
  for (const k of ['6', '8', '0']) {
    await page.getByRole('button', { name: k, exact: true }).first().click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/weigh.png` });
  console.log('  weigh.png');

  await ctx.close();
}

await browser.close();
console.log('Done.');
