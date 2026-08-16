import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { buildLitterView, type LitterView } from '../logic/triage';

/**
 * Reads the four raw tables and derives everything else. Nothing computed is
 * ever written back, so there is no refresh button and no stale state: one
 * weight lands and the matrix, chart, banner, timeline and care cards all
 * re-render from the same pure function.
 */
export async function loadLitterView(
  litterId: number,
  now: number = Date.now()
): Promise<LitterView | undefined> {
  const litter = await db.litters.get(litterId);
  if (!litter) return undefined;
  const puppies = await db.puppies.where({ litterId }).toArray();
  const ids = puppies.map((p) => p.id!);
  const weights = ids.length
    ? await db.weights.where('puppyId').anyOf(ids).sortBy('at')
    : [];
  const care = await db.care.where({ litterId }).toArray();
  return buildLitterView(litter, puppies, weights, care, now);
}

export function useLitterView(litterId: number | undefined) {
  return useLiveQuery(async () => {
    if (litterId === undefined) return undefined;
    return loadLitterView(litterId);
  }, [litterId]);
}

/**
 * The single litter this device is tracking.
 *
 * Returns `undefined` while the query is still running and `null` when there
 * genuinely is no litter — collapsing the two would leave a first-time visitor
 * staring at a loading state forever.
 */
export function useCurrentLitter() {
  return useLiveQuery(async () => {
    const all = await db.litters.orderBy('whelpedAt').reverse().toArray();
    return all[0] ?? null;
  }, []);
}

export function useSeals(puppyId: number | undefined) {
  return useLiveQuery(async () => {
    if (puppyId === undefined) return [];
    return db.seals.where({ puppyId }).reverse().sortBy('sealedAt');
  }, [puppyId]);
}
