import { db, type CollarColour } from './schema';
import { HOUR } from './constants';

/**
 * A judge (or a breeder evaluating the app) should never meet an empty form.
 * This litter is six days old and already has a puppy in trouble, so the
 * triage engine has something to say the moment the app opens.
 *
 * The numbers are hard-coded rather than randomised so the demo is identical
 * on every machine and the screenshots in the README always match.
 */

interface SeedPuppy {
  collar: CollarColour;
  name: string;
  sex: 'M' | 'F';
  /** Grams on days 0 through 6. */
  series: number[];
}

export const SEED_PUPPIES: SeedPuppy[] = [
  { collar: 'blue', name: 'Bramble', sex: 'M', series: [420, 452, 486, 522, 561, 603, 648] },
  { collar: 'red', name: 'Rowan', sex: 'M', series: [445, 478, 514, 552, 593, 637, 685] },
  // Green stalls from day four, then loses on day six. Two warnings, one
  // critical, and a wide gap to the litter median.
  { collar: 'green', name: 'Gorse', sex: 'F', series: [380, 408, 438, 470, 470, 468, 420] },
  { collar: 'yellow', name: 'Yarrow', sex: 'F', series: [410, 440, 473, 508, 546, 587, 631] },
  { collar: 'purple', name: 'Plum', sex: 'F', series: [398, 428, 460, 494, 531, 571, 613] },
  { collar: 'orange', name: 'Otter', sex: 'M', series: [432, 464, 499, 536, 576, 619, 665] },
  { collar: 'pink', name: 'Pippin', sex: 'F', series: [405, 435, 467, 502, 539, 579, 622] },
];

/**
 * Hour of the local day each weigh-in happened. Day 0 is the whelp itself;
 * after that the time drifts a little, the way a real notebook does.
 */
export const OFFSET_HOURS = [6, 7.5, 7, 8, 7.25, 8.5, 7.75];

/** How many calendar days old the seeded litter is. */
export const SEED_AGE_DAYS = 6;

/**
 * Six calendar days ago at 6am local.
 *
 * Anchored to a date rather than to "now minus 156 hours", because days are
 * calendar days: an hour offset would make the litter six days old in the
 * afternoon and seven in the early morning.
 */
export function seedWhelpedAt(now: number = Date.now()): number {
  const d = new Date(now);
  d.setDate(d.getDate() - SEED_AGE_DAYS);
  d.setHours(OFFSET_HOURS[0], 0, 0, 0);
  return d.getTime();
}

/** Local midnight of the seeded litter's day `day`. */
function seedDayStart(whelpedAt: number, day: number): number {
  const d = new Date(whelpedAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + day);
  return d.getTime();
}

/** When day `day` was weighed — never in the future, always inside that day. */
function seedWeighAt(whelpedAt: number, day: number, now: number): number {
  const start = seedDayStart(whelpedAt, day);
  const target = start + OFFSET_HOURS[day] * HOUR;
  // Today's weigh-in may not have happened yet at this hour, so pull it back
  // rather than dating a weight in the future.
  return Math.max(start, Math.min(target, now - 60_000));
}

export async function loadDemoLitter(now: number = Date.now()): Promise<number> {
  // Six calendar days old, with today's weigh-in already recorded, so nothing
  // trips the "no weight in 36h" rule the moment the demo opens.
  const whelpedAt = seedWhelpedAt(now);

  return db.transaction('rw', db.litters, db.puppies, db.weights, db.care, db.seals, async () => {
    const litterId = await db.litters.add({
      damName: 'Nala',
      sireName: 'Bruno',
      breed: 'Labrador Retriever',
      whelpedAt,
    });

    for (const sp of SEED_PUPPIES) {
      const puppyId = await db.puppies.add({
        litterId,
        collar: sp.collar,
        name: sp.name,
        sex: sp.sex,
      });

      for (const [day, grams] of sp.series.entries()) {
        await db.weights.add({
          puppyId,
          at: seedWeighAt(whelpedAt, day, now),
          grams,
          source: day === 0 ? 'manual' : 'voice',
        });
      }
    }

    await db.care.add({
      litterId,
      kind: 'note',
      at: seedDayStart(whelpedAt, 4) + 9 * HOUR,
      note: 'Gorse slow to latch at the morning feed. Watching closely.',
    });

    return litterId;
  });
}

export async function hasAnyLitter(): Promise<boolean> {
  return (await db.litters.count()) > 0;
}

/** Wipes everything on this device and reloads the demo. */
export async function resetDemo(): Promise<number> {
  await clearAll();
  return loadDemoLitter();
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.litters, db.puppies, db.weights, db.care, db.seals, async () => {
    await Promise.all([
      db.weights.clear(),
      db.care.clear(),
      db.puppies.clear(),
      db.litters.clear(),
      db.seals.clear(),
    ]);
  });
}
