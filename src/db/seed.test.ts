import { describe, it, expect } from 'vitest';
import { OFFSET_HOURS, SEED_AGE_MS, SEED_PUPPIES } from './seed';
import { DAY, HOUR } from './constants';
import { buildLitterView } from '../logic/triage';
import type { Litter, Puppy, WeightEntry } from './schema';

/**
 * The demo litter is the first thing anyone sees, so its alert profile is
 * pinned here. If a rule threshold moves, this test fails and the demo gets
 * looked at rather than quietly becoming boring or crying wolf.
 */

const NOW = new Date('2026-08-16T09:00:00Z').getTime();
const WHELPED = NOW - SEED_AGE_MS;

const litter: Litter = {
  id: 1,
  damName: 'Nala',
  sireName: 'Bruno',
  breed: 'Labrador Retriever',
  whelpedAt: WHELPED,
};

const puppies: Puppy[] = SEED_PUPPIES.map((sp, i) => ({
  id: i + 1,
  litterId: 1,
  collar: sp.collar,
  name: sp.name,
  sex: sp.sex,
}));

const weights: WeightEntry[] = [];
let wid = 1;
for (const [i, sp] of SEED_PUPPIES.entries()) {
  for (const [day, grams] of sp.series.entries()) {
    weights.push({
      id: wid++,
      puppyId: i + 1,
      at: WHELPED + day * DAY + OFFSET_HOURS[day] * HOUR,
      grams,
      source: 'manual',
    });
  }
}

const v = buildLitterView(litter, puppies, weights, [], NOW);
const green = v.puppies.find((p) => p.puppy.collar === 'green')!;

describe('the demo litter', () => {
  it('is six days old with seven puppies', () => {
    expect(v.ageDays).toBe(6);
    expect(v.puppies).toHaveLength(7);
  });

  it('opens on a live critical alert rather than an empty form', () => {
    expect(v.counts.critical).toBeGreaterThan(0);
    expect(v.worstPuppyId).toBe(green.id);
  });

  it('flags green, and only green', () => {
    const flagged = v.puppies.filter((p) => p.severity).map((p) => p.puppy.collar);
    expect(flagged).toEqual(['green']);
  });

  it('trips failure to gain, weight loss, divergence and significant loss on green', () => {
    const rules = green.alerts.map((a) => a.ruleId).sort();
    expect(rules).toEqual(
      ['failure-to-gain', 'litter-divergence', 'significant-loss', 'weight-loss'].sort()
    );
  });

  it('leaves green above its birth weight, so the critical is the peak loss', () => {
    expect(green.latest!.grams).toBeGreaterThan(green.birthWeight!);
  });

  it('sits green well below the litter median', () => {
    const day6 = v.days.find((d) => d.day === 6)!;
    expect(day6.median).not.toBeNull();
    expect(green.latest!.grams / day6.median!).toBeLessThan(0.75);
  });

  it('raises no missing-entry noise — every puppy was weighed recently', () => {
    expect(v.alerts.filter((a) => a.ruleId === 'missing-entry')).toEqual([]);
  });

  it('gives every healthy puppy a normal daily gain', () => {
    for (const p of v.puppies) {
      if (p.puppy.collar === 'green') continue;
      const gain = p.cells[6].gainPct!;
      expect(gain).toBeGreaterThan(0.05);
      expect(gain).toBeLessThan(0.1);
    }
  });
});
