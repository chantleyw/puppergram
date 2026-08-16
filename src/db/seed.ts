import { db, type CollarColour } from './schema';
import { DAY, HOUR } from './constants';

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

/** Weigh-in time drifts a little each day, the way a real notebook does. */
export const OFFSET_HOURS = [0, 7.5, 7, 8, 7.25, 8.5, 7.75];

/** The seeded litter's age offset, shared with the seed test. */
export const SEED_AGE_MS = 6 * DAY + 8 * HOUR;

export async function loadDemoLitter(now: number = Date.now()): Promise<number> {
  // Whelped six days and eight hours ago, so the day-six weights are recent
  // enough that nothing trips the "no weight in 36h" rule.
  const whelpedAt = now - SEED_AGE_MS;

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
          at: whelpedAt + day * DAY + OFFSET_HOURS[day] * HOUR,
          grams,
          source: day === 0 ? 'manual' : 'voice',
        });
      }
    }

    await db.care.add({
      litterId,
      kind: 'note',
      at: whelpedAt + 4 * DAY + 9 * HOUR,
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
