import { DAY, EXPECTED_DAILY_GAIN_MAX, EXPECTED_DAILY_GAIN_MIN, HOUR } from '../db/constants';
import type { CareEvent, Litter, Puppy, WeightEntry } from '../db/schema';
import { buildMilestones, type MilestoneView } from './milestones';
import { feedingPlan, tempTargetForDay, type FeedingPlan } from './feeding';
import type { TempTarget } from '../db/constants';

/* ================================================================== */
/* Rule definitions — surfaced verbatim in the UI and the README       */
/* ================================================================== */

export type Severity = 'critical' | 'warning' | 'info';

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export type RuleId =
  | 'failure-to-gain'
  | 'weight-loss'
  | 'below-birth-weight'
  | 'significant-loss'
  | 'slow-doubling'
  | 'litter-divergence'
  | 'missing-entry';

export interface RuleDef {
  id: RuleId;
  name: string;
  condition: string;
  severity: Severity;
}

/** The full rule table. Rendered as-is under "How alerts work". */
export const RULES: RuleDef[] = [
  {
    id: 'failure-to-gain',
    name: 'Failure to gain',
    condition: 'No weight increase in 24h',
    severity: 'warning',
  },
  {
    id: 'weight-loss',
    name: 'Weight loss',
    condition: 'Any drop vs. previous entry',
    severity: 'warning',
  },
  {
    id: 'below-birth-weight',
    name: 'Below birth weight',
    condition: 'Current < birth weight after 48h',
    severity: 'critical',
  },
  {
    id: 'significant-loss',
    name: 'Significant loss',
    condition: 'More than 10% below peak weight',
    severity: 'critical',
  },
  {
    id: 'slow-doubling',
    name: 'Slow doubling',
    condition: 'Under 1.8× birth weight by day 10',
    severity: 'warning',
  },
  {
    id: 'litter-divergence',
    name: 'Litter divergence',
    condition: 'More than 25% below litter median on day N',
    severity: 'warning',
  },
  {
    id: 'missing-entry',
    name: 'Missing entry',
    condition: 'No weight logged in 36h',
    severity: 'info',
  },
];

/* Thresholds, named so the tests read like the table above. */
export const T = {
  failureToGainWindowMs: 24 * HOUR,
  belowBirthGraceMs: 48 * HOUR,
  significantLossFraction: 0.1, // >10% below peak
  doublingCheckDay: 10,
  doublingMultiple: 1.8,
  divergenceFraction: 0.25, // >25% below median
  divergenceMinPuppies: 3, // a median of two is just an average
  missingEntryMs: 36 * HOUR,
} as const;

/* ================================================================== */
/* View types                                                          */
/* ================================================================== */

export interface Alert {
  ruleId: RuleId;
  severity: Severity;
  title: string;
  /** What the data shows. */
  detail: string;
  /** What to do about it, in plain language. */
  action: string;
  puppyId: number;
}

export interface WeightPoint {
  id?: number;
  at: number;
  grams: number;
  day: number;
  source: WeightEntry['source'];
}

export interface DayCell {
  day: number;
  /** Last weight recorded within this day, if any. */
  point: WeightPoint | null;
  /** Change vs. the previous day that has a weight. */
  gainGrams: number | null;
  gainPct: number | null;
}

export interface PuppyView {
  puppy: Puppy;
  id: number;
  label: string;
  points: WeightPoint[];
  birthWeight: number | null;
  latest: WeightPoint | null;
  previous: WeightPoint | null;
  peak: number | null;
  /** Change between the two most recent entries. */
  lastChangeGrams: number | null;
  lastChangePct: number | null;
  multipleOfBirth: number | null;
  cells: Record<number, DayCell>;
  alerts: Alert[];
  severity: Severity | null;
  feeding: FeedingPlan | null;
  /** Expected weight range at the next weigh-in, from the latest weight. */
  expectedNext: { min: number; max: number } | null;
}

export interface DayColumn {
  day: number;
  startsAt: number;
  label: string;
  /** Median of all puppies' last weight on this day; null if too few. */
  median: number | null;
}

export interface LitterView {
  litter: Litter;
  litterId: number;
  now: number;
  ageDays: number;
  ageLabel: string;
  days: DayColumn[];
  puppies: PuppyView[];
  alerts: Alert[];
  counts: Record<Severity, number>;
  worstPuppyId: number | null;
  milestones: MilestoneView[];
  tempTarget: TempTarget;
  care: CareEvent[];
  totalWeights: number;
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

export function dayIndex(at: number, whelpedAt: number): number {
  return Math.floor((at - whelpedAt) / DAY);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function puppyLabel(p: Puppy): string {
  const collar = p.collar.charAt(0).toUpperCase() + p.collar.slice(1);
  return p.name ? `${collar} (${p.name})` : collar;
}

export function ageLabelFor(ageDays: number): string {
  if (ageDays < 0) return 'Not yet whelped';
  const weeks = Math.floor(ageDays / 7);
  const rem = ageDays % 7;
  if (ageDays < 7) return `Day ${ageDays}`;
  return `Day ${ageDays} · ${weeks}w${rem ? ` ${rem}d` : ''}`;
}

/* ================================================================== */
/* The engine                                                          */
/* ================================================================== */

/**
 * Pure. Litter + puppies + weights + care in, complete view out.
 * No I/O, no state, nothing written back to the database.
 *
 * `now` is a parameter rather than a `Date.now()` call so the time-window
 * rules (24h, 36h, 48h) are deterministically testable.
 */
export function buildLitterView(
  litter: Litter,
  puppies: Puppy[],
  weights: WeightEntry[],
  care: CareEvent[],
  now: number = Date.now()
): LitterView {
  const litterId = litter.id!;
  const whelpedAt = litter.whelpedAt;
  const ageDays = Math.max(0, dayIndex(now, whelpedAt));

  const byPuppy = new Map<number, WeightPoint[]>();
  for (const p of puppies) byPuppy.set(p.id!, []);
  for (const w of [...weights].sort((a, b) => a.at - b.at)) {
    const list = byPuppy.get(w.puppyId);
    if (!list) continue;
    list.push({
      id: w.id,
      at: w.at,
      grams: w.grams,
      day: dayIndex(w.at, whelpedAt),
      source: w.source,
    });
  }

  /* ---- day columns: every day that has data, plus today ---- */
  const daySet = new Set<number>();
  for (const list of byPuppy.values()) for (const pt of list) daySet.add(pt.day);
  daySet.add(0);
  daySet.add(ageDays);
  const dayNumbers = [...daySet].filter((d) => d >= 0).sort((a, b) => a - b);

  /* ---- per-day median, from each puppy's last weight that day ---- */
  const medianByDay = new Map<number, number | null>();
  for (const d of dayNumbers) {
    const vals: number[] = [];
    for (const list of byPuppy.values()) {
      const onDay = list.filter((pt) => pt.day === d);
      if (onDay.length) vals.push(onDay[onDay.length - 1].grams);
    }
    medianByDay.set(d, vals.length >= T.divergenceMinPuppies ? median(vals) : null);
  }

  const days: DayColumn[] = dayNumbers.map((d) => ({
    day: d,
    startsAt: whelpedAt + d * DAY,
    label: `Day ${d}`,
    median: medianByDay.get(d) ?? null,
  }));

  /* ---- per puppy ---- */
  const puppyViews: PuppyView[] = puppies.map((p) => {
    const points = byPuppy.get(p.id!) ?? [];
    const birthWeight = points.length ? points[0].grams : null;
    const latest = points.length ? points[points.length - 1] : null;
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const peak = points.length ? Math.max(...points.map((pt) => pt.grams)) : null;

    const cells: Record<number, DayCell> = {};
    let prevDayGrams: number | null = null;
    for (const d of dayNumbers) {
      const onDay = points.filter((pt) => pt.day === d);
      const point = onDay.length ? onDay[onDay.length - 1] : null;
      let gainGrams: number | null = null;
      let gainPct: number | null = null;
      if (point && prevDayGrams !== null) {
        gainGrams = point.grams - prevDayGrams;
        gainPct = gainGrams / prevDayGrams;
      }
      cells[d] = { day: d, point, gainGrams, gainPct };
      if (point) prevDayGrams = point.grams;
    }

    const alerts = evaluateRules({
      puppy: p,
      points,
      birthWeight,
      latest,
      previous,
      peak,
      whelpedAt,
      ageDays,
      now,
      medianByDay,
    });

    alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    const severity = alerts.length ? alerts[0].severity : null;

    const lastChangeGrams =
      latest && previous ? latest.grams - previous.grams : null;
    const lastChangePct =
      latest && previous ? (latest.grams - previous.grams) / previous.grams : null;

    return {
      puppy: p,
      id: p.id!,
      label: puppyLabel(p),
      points,
      birthWeight,
      latest,
      previous,
      peak,
      lastChangeGrams,
      lastChangePct,
      multipleOfBirth:
        latest && birthWeight ? latest.grams / birthWeight : null,
      cells,
      alerts,
      severity,
      feeding: latest ? feedingPlan(latest.grams, ageDays) : null,
      expectedNext: latest
        ? {
            min: Math.round(latest.grams * (1 + EXPECTED_DAILY_GAIN_MIN)),
            max: Math.round(latest.grams * (1 + EXPECTED_DAILY_GAIN_MAX)),
          }
        : null,
    };
  });

  const allAlerts = puppyViews
    .flatMap((p) => p.alerts)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const a of allAlerts) counts[a.severity] += 1;

  const worst = puppyViews
    .filter((p) => p.severity)
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.severity!] - SEVERITY_RANK[a.severity!] ||
        b.alerts.length - a.alerts.length
    )[0];

  return {
    litter,
    litterId,
    now,
    ageDays,
    ageLabel: ageLabelFor(ageDays),
    days,
    puppies: puppyViews,
    alerts: allAlerts,
    counts,
    worstPuppyId: worst?.id ?? null,
    // Birth is satisfied by the data, not by a checkbox: if every puppy has a
    // weight on day 0, the birth weights are recorded and there is nothing to
    // prompt for.
    milestones: buildMilestones(
      ageDays,
      care,
      new Set(
        puppyViews.length > 0 &&
        puppyViews.every((p) => p.points.some((pt) => pt.day === 0))
          ? ['birth']
          : []
      )
    ),
    tempTarget: tempTargetForDay(ageDays),
    care: [...care].sort((a, b) => b.at - a.at),
    totalWeights: weights.length,
  };
}

/* ------------------------------------------------------------------ */

interface RuleInput {
  puppy: Puppy;
  points: WeightPoint[];
  birthWeight: number | null;
  latest: WeightPoint | null;
  previous: WeightPoint | null;
  peak: number | null;
  whelpedAt: number;
  ageDays: number;
  now: number;
  medianByDay: Map<number, number | null>;
}

const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;

export function evaluateRules(input: RuleInput): Alert[] {
  const {
    puppy,
    points,
    birthWeight,
    latest,
    previous,
    peak,
    whelpedAt,
    ageDays,
    now,
    medianByDay,
  } = input;

  const id = puppy.id!;
  const name = puppyLabel(puppy);
  const out: Alert[] = [];
  const add = (
    ruleId: RuleId,
    detail: string,
    action: string,
    severityOverride?: Severity
  ) => {
    const rule = RULES.find((r) => r.id === ruleId)!;
    out.push({
      ruleId,
      severity: severityOverride ?? rule.severity,
      title: rule.name,
      detail,
      action,
      puppyId: id,
    });
  };

  /* --- Missing entry: no weight logged in 36h (Info) --- */
  if (!latest) {
    add(
      'missing-entry',
      `No weight recorded for ${name} yet.`,
      `Weigh ${name} and record the birth weight. Everything else is measured against it.`
    );
    return out;
  }

  if (now - latest.at > T.missingEntryMs) {
    const hours = Math.floor((now - latest.at) / HOUR);
    add(
      'missing-entry',
      `${name} was last weighed ${hours} hours ago.`,
      `Weigh ${name} at the next feed so the trend stays readable.`
    );
  }

  /* --- Below birth weight after 48h (Critical) --- */
  if (
    birthWeight !== null &&
    latest.at - whelpedAt >= T.belowBirthGraceMs &&
    latest.grams < birthWeight
  ) {
    add(
      'below-birth-weight',
      `${name} is ${birthWeight - latest.grams} g below its birth weight of ${birthWeight} g at ${Math.floor(
        (latest.at - whelpedAt) / HOUR
      )} hours old.`,
      `Contact your vet today. A neonate below birth weight after 48 hours is not feeding adequately. Check latching, box temperature, and whether ${name} is being pushed off the teat.`
    );
  }

  /* --- More than 10% below peak (Critical) --- */
  if (peak !== null && latest.grams < peak * (1 - T.significantLossFraction)) {
    const drop = (peak - latest.grams) / peak;
    add(
      'significant-loss',
      `${name} is ${pct(drop)} below its peak weight of ${peak} g.`,
      `Contact your vet today. Losses of this size in a neonate escalate quickly. Start supplemental feeding and check box temperature while you wait.`
    );
  }

  /* --- Any drop vs. previous entry (Warning) --- */
  if (previous && latest.grams < previous.grams) {
    add(
      'weight-loss',
      `${name} dropped ${previous.grams - latest.grams} g since the previous weigh-in.`,
      `Check that ${name} is latching, and check box temperature. Contact your vet if there is no gain by the next weigh-in.`
    );
  }

  /* --- No increase in 24h (Warning) --- */
  const dayAgo = latest.at - T.failureToGainWindowMs;
  const priorDay = [...points].reverse().find((pt) => pt.at <= dayAgo);
  if (priorDay && latest.grams <= priorDay.grams) {
    add(
      'failure-to-gain',
      `${name} has not gained in 24 hours (${priorDay.grams} g → ${latest.grams} g).`,
      `Check that ${name} is latching, and check box temperature. Contact your vet if there is no gain by the next weigh-in.`
    );
  }

  /* --- Under 1.8x birth weight by day 10 (Warning) --- */
  if (
    birthWeight !== null &&
    ageDays >= T.doublingCheckDay &&
    latest.grams < birthWeight * T.doublingMultiple
  ) {
    const mult = (latest.grams / birthWeight).toFixed(2);
    add(
      'slow-doubling',
      `${name} is at ${mult}× its birth weight on day ${ageDays}. Expected at least ${T.doublingMultiple}× by day ${T.doublingCheckDay}.`,
      `Weigh ${name} twice daily and consider supplemental feeding. Raise the growth curve with your vet at the next visit.`
    );
  }

  /* --- More than 25% below litter median on day N (Warning) --- */
  const med = medianByDay.get(latest.day) ?? null;
  if (med !== null && latest.grams < med * (1 - T.divergenceFraction)) {
    const below = (med - latest.grams) / med;
    add(
      'litter-divergence',
      `${name} is ${pct(below)} below the litter median of ${med} g on day ${latest.day}.`,
      `Give ${name} first access at feeds, or separate the litter briefly so it can nurse undisturbed. Mention the gap to your vet.`
    );
  }

  return out;
}

/** Expected daily gain, expressed for the UI. */
export const EXPECTED_GAIN_LABEL = `${Math.round(
  EXPECTED_DAILY_GAIN_MIN * 100
)}–${Math.round(EXPECTED_DAILY_GAIN_MAX * 100)}% per day`;
