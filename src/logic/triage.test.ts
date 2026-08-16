import { describe, it, expect } from 'vitest';
import { buildLitterView, type RuleId, type Severity } from './triage';
import { DAY, HOUR } from '../db/constants';
import type { CareEvent, CollarColour, Litter, Puppy, WeightEntry } from '../db/schema';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const WHELPED = new Date('2026-08-01T00:00:00Z').getTime();

const litter: Litter = {
  id: 1,
  damName: 'Nala',
  sireName: 'Bruno',
  breed: 'Labrador Retriever',
  whelpedAt: WHELPED,
};

let nextPuppyId = 1;
function pup(collar: CollarColour, name?: string): Puppy {
  return { id: nextPuppyId++, litterId: 1, collar, name, sex: 'M' };
}

let nextWeightId = 1;
/** `hours` is hours since whelp. */
function w(puppyId: number, hours: number, grams: number): WeightEntry {
  return {
    id: nextWeightId++,
    puppyId,
    at: WHELPED + hours * HOUR,
    grams,
    source: 'manual',
  };
}

function view(
  puppies: Puppy[],
  weights: WeightEntry[],
  nowHours: number,
  care: CareEvent[] = []
) {
  return buildLitterView(litter, puppies, weights, care, WHELPED + nowHours * HOUR);
}

function rulesFor(v: ReturnType<typeof view>, puppyId: number): RuleId[] {
  return v.puppies.find((p) => p.id === puppyId)!.alerts.map((a) => a.ruleId);
}

function severityFor(v: ReturnType<typeof view>, puppyId: number): Severity | null {
  return v.puppies.find((p) => p.id === puppyId)!.severity;
}

/* ------------------------------------------------------------------ */
/* A healthy litter must produce zero alerts. This is the test that     */
/* protects trust: false alarms at 3am are the real failure mode.       */
/* ------------------------------------------------------------------ */

describe('a normally growing litter', () => {
  const a = pup('blue');
  const b = pup('red');
  const c = pup('green');
  const puppies = [a, b, c];

  // 7% per day for six days, weighed every 24h.
  const weights: WeightEntry[] = [];
  for (const [i, p] of puppies.entries()) {
    let g = 400 + i * 10;
    for (let d = 0; d <= 6; d++) {
      weights.push(w(p.id!, d * 24, Math.round(g)));
      g *= 1.07;
    }
  }

  const v = view(puppies, weights, 6 * 24 + 1);

  it('raises no alerts at all', () => {
    expect(v.alerts).toEqual([]);
    expect(v.counts).toEqual({ critical: 0, warning: 0, info: 0 });
    expect(v.worstPuppyId).toBeNull();
  });

  it('derives birth weight from the earliest entry, not a stored field', () => {
    expect(v.puppies[0].birthWeight).toBe(400);
  });

  it('tracks the multiple of birth weight', () => {
    expect(v.puppies[0].multipleOfBirth).toBeCloseTo(1.5, 1);
  });

  it('builds one day column per day with data', () => {
    expect(v.days.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('computes a litter median once enough puppies are weighed', () => {
    expect(v.days[0].median).toBe(410);
  });

  it('computes per-day gains', () => {
    const cell = v.puppies[0].cells[1];
    expect(cell.gainGrams).toBe(28);
    expect(cell.gainPct).toBeCloseTo(0.07, 2);
  });
});

/* ------------------------------------------------------------------ */
/* Each rule in isolation                                              */
/* ------------------------------------------------------------------ */

describe('failure to gain — no increase in 24h (warning)', () => {
  it('fires when the weight is identical 24h later', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 24, 400)], 25);
    expect(rulesFor(v, p.id!)).toContain('failure-to-gain');
    expect(severityFor(v, p.id!)).toBe('warning');
  });

  it('does not fire on a gain, however small', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 24, 401)], 25);
    expect(rulesFor(v, p.id!)).not.toContain('failure-to-gain');
  });

  it('does not fire before 24h of data exists', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 12, 400)], 13);
    expect(rulesFor(v, p.id!)).not.toContain('failure-to-gain');
  });
});

describe('weight loss — any drop vs. previous entry (warning)', () => {
  it('fires on a one-gram drop', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 12, 399)], 13);
    expect(rulesFor(v, p.id!)).toContain('weight-loss');
  });

  it('does not fire when flat', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 12, 400)], 13);
    expect(rulesFor(v, p.id!)).not.toContain('weight-loss');
  });
});

describe('below birth weight after 48h (critical)', () => {
  it('does not fire inside the 48h grace window', () => {
    // Normal neonates dip in the first 24-48h, so this must stay quiet.
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 36, 385)], 37);
    expect(rulesFor(v, p.id!)).not.toContain('below-birth-weight');
  });

  it('fires once past 48h and still under birth weight', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 48, 385)], 49);
    expect(rulesFor(v, p.id!)).toContain('below-birth-weight');
    expect(severityFor(v, p.id!)).toBe('critical');
  });

  it('does not fire when back above birth weight', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 48, 401)], 49);
    expect(rulesFor(v, p.id!)).not.toContain('below-birth-weight');
  });
});

describe('significant loss — more than 10% below peak (critical)', () => {
  it('does not fire at exactly 10% below peak', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 24, 500), w(p.id!, 48, 450)], 49);
    expect(rulesFor(v, p.id!)).not.toContain('significant-loss');
  });

  it('fires just past 10% below peak', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 24, 500), w(p.id!, 48, 449)], 49);
    expect(rulesFor(v, p.id!)).toContain('significant-loss');
    expect(severityFor(v, p.id!)).toBe('critical');
  });
});

describe('slow doubling — under 1.8x birth weight by day 10 (warning)', () => {
  it('does not fire before day 10', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 9 * 24, 600)], 9 * 24 + 1);
    expect(rulesFor(v, p.id!)).not.toContain('slow-doubling');
  });

  it('fires on day 10 when under 1.8x', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 10 * 24, 700)], 10 * 24 + 1);
    expect(rulesFor(v, p.id!)).toContain('slow-doubling');
  });

  it('does not fire on day 10 when at or above 1.8x', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 10 * 24, 720)], 10 * 24 + 1);
    expect(rulesFor(v, p.id!)).not.toContain('slow-doubling');
  });
});

describe('litter divergence — more than 25% below median on day N (warning)', () => {
  it('fires for the runt against a healthy median', () => {
    const a = pup('blue');
    const b = pup('red');
    const c = pup('green');
    const runt = pup('yellow');
    const weights = [
      w(a.id!, 24, 500),
      w(b.id!, 24, 500),
      w(c.id!, 24, 520),
      w(runt.id!, 24, 300),
      // birth entries so the runt is not also flagged for other rules
      w(a.id!, 0, 480),
      w(b.id!, 0, 480),
      w(c.id!, 0, 500),
      w(runt.id!, 0, 290),
    ];
    const v = view([a, b, c, runt], weights, 25);
    expect(rulesFor(v, runt.id!)).toContain('litter-divergence');
    expect(rulesFor(v, a.id!)).not.toContain('litter-divergence');
  });

  it('does not compute a median from fewer than three puppies', () => {
    const a = pup('blue');
    const b = pup('red');
    const v = view([a, b], [w(a.id!, 0, 500), w(b.id!, 0, 300)], 1);
    expect(v.days[0].median).toBeNull();
    expect(rulesFor(v, b.id!)).not.toContain('litter-divergence');
  });
});

describe('missing entry — no weight in 36h (info)', () => {
  it('does not fire at 35h', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400)], 35);
    expect(rulesFor(v, p.id!)).not.toContain('missing-entry');
  });

  it('fires at 37h', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400)], 37);
    expect(rulesFor(v, p.id!)).toContain('missing-entry');
    expect(severityFor(v, p.id!)).toBe('info');
  });

  it('fires for a puppy with no weights at all', () => {
    const p = pup('blue');
    const v = view([p], [], 1);
    expect(rulesFor(v, p.id!)).toEqual(['missing-entry']);
  });
});

/* ------------------------------------------------------------------ */
/* Severity ordering and aggregation                                   */
/* ------------------------------------------------------------------ */

describe('severity ordering', () => {
  it('surfaces only the highest severity for a puppy', () => {
    const p = pup('blue');
    // Below birth weight (critical) AND a drop (warning) AND flat 24h (warning)
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 48, 380), w(p.id!, 72, 370)], 73);
    expect(severityFor(v, p.id!)).toBe('critical');
    expect(rulesFor(v, p.id!).length).toBeGreaterThan(1);
  });

  it('points the litter banner at the worst-affected puppy', () => {
    const healthy = pup('blue');
    const sick = pup('red');
    const other = pup('green');
    const weights = [
      w(healthy.id!, 0, 400),
      w(healthy.id!, 48, 460),
      w(other.id!, 0, 400),
      w(other.id!, 48, 460),
      w(sick.id!, 0, 400),
      w(sick.id!, 48, 350),
    ];
    const v = view([healthy, sick, other], weights, 49);
    expect(v.worstPuppyId).toBe(sick.id);
    expect(v.counts.critical).toBeGreaterThan(0);
  });

  it('every alert carries a plain-language action line', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400), w(p.id!, 48, 350)], 49);
    for (const a of v.alerts) {
      expect(a.action.length).toBeGreaterThan(20);
      expect(a.action).not.toMatch(/!/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Purity and derived state                                            */
/* ------------------------------------------------------------------ */

describe('purity', () => {
  it('does not mutate its inputs', () => {
    const p = pup('blue');
    const weights = [w(p.id!, 24, 430), w(p.id!, 0, 400)];
    const snapshot = JSON.stringify(weights);
    buildLitterView(litter, [p], weights, [], WHELPED + 25 * HOUR);
    expect(JSON.stringify(weights)).toBe(snapshot);
  });

  it('sorts unsorted weight input before deriving anything', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 48, 460), w(p.id!, 0, 400), w(p.id!, 24, 430)], 49);
    expect(v.puppies[0].birthWeight).toBe(400);
    expect(v.puppies[0].latest!.grams).toBe(460);
  });

  it('is deterministic for the same inputs', () => {
    const p = pup('blue');
    const weights = [w(p.id!, 0, 400), w(p.id!, 24, 430)];
    const now = WHELPED + 25 * HOUR;
    const a = buildLitterView(litter, [p], weights, [], now);
    const b = buildLitterView(litter, [p], weights, [], now);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('derived care state', () => {
  it('marks a deworming milestone done when a matching care event exists', () => {
    const p = pup('blue');
    const care: CareEvent[] = [
      { id: 1, litterId: 1, kind: 'deworming', at: WHELPED + 14 * DAY },
    ];
    const v = view([p], [w(p.id!, 0, 400)], 15 * 24, care);
    const first = v.milestones.find((m) => m.id === 'deworm-1')!;
    const second = v.milestones.find((m) => m.id === 'deworm-2')!;
    expect(first.state).toBe('done');
    expect(second.state).toBe('pending');
  });

  it('moves a milestone from pending to due as the litter ages', () => {
    const p = pup('blue');
    const young = view([p], [w(p.id!, 0, 400)], 5 * 24);
    const older = view([p], [w(p.id!, 0, 400)], 20 * 24);
    expect(young.milestones.find((m) => m.id === 'deworm-1')!.state).toBe('pending');
    expect(older.milestones.find((m) => m.id === 'deworm-1')!.state).toBe('due');
  });

  it('picks the right temperature target for the litter age', () => {
    const p = pup('blue');
    expect(view([p], [], 3 * 24).tempTarget.minC).toBe(29);
    expect(view([p], [], 9 * 24).tempTarget.minC).toBe(26);
    expect(view([p], [], 30 * 24).tempTarget.minC).toBe(21);
  });

  it('computes a feeding plan from the latest weight', () => {
    const p = pup('blue');
    const v = view([p], [w(p.id!, 0, 400)], 1);
    const f = v.puppies[0].feeding!;
    expect(f.dailyMlMin).toBe(60); // 400g / 100 * 15
    expect(f.dailyMlMax).toBe(80); // 400g / 100 * 20
    expect(f.feedsPerDay).toBe(10);
    expect(f.workings).toContain('60');
  });
});
