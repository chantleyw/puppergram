import {
  FEED_SCHEDULE,
  ML_PER_100G_MAX,
  ML_PER_100G_MIN,
  TEMP_TARGETS,
  type TempTarget,
} from '../db/constants';

export interface FeedingPlan {
  grams: number;
  /** Total millilitres per 24 hours, low and high end of the guideline. */
  dailyMlMin: number;
  dailyMlMax: number;
  feedsPerDay: number;
  intervalLabel: string;
  perFeedMlMin: number;
  perFeedMlMax: number;
  /** Human-readable arithmetic, shown in the UI rather than hidden. */
  workings: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function feedScheduleForDay(day: number) {
  let chosen = FEED_SCHEDULE[0];
  for (const s of FEED_SCHEDULE) if (day >= s.fromDay) chosen = s;
  return chosen;
}

/**
 * 15–20 ml of formula per 100 g of body weight per day, divided across the
 * age-appropriate number of feeds. The arithmetic is returned as text so the
 * card can show its own working instead of asking for trust.
 */
export function feedingPlan(grams: number, day: number): FeedingPlan {
  const { feedsPerDay, intervalLabel } = feedScheduleForDay(day);
  const hundreds = grams / 100;
  const dailyMlMin = round1(hundreds * ML_PER_100G_MIN);
  const dailyMlMax = round1(hundreds * ML_PER_100G_MAX);
  const perFeedMlMin = round1(dailyMlMin / feedsPerDay);
  const perFeedMlMax = round1(dailyMlMax / feedsPerDay);

  const workings =
    `${grams} g ÷ 100 = ${round1(hundreds)} × ${ML_PER_100G_MIN}–${ML_PER_100G_MAX} ml ` +
    `= ${dailyMlMin}–${dailyMlMax} ml per day ÷ ${feedsPerDay} feeds ` +
    `= ${perFeedMlMin}–${perFeedMlMax} ml per feed`;

  return {
    grams,
    dailyMlMin,
    dailyMlMax,
    feedsPerDay,
    intervalLabel,
    perFeedMlMin,
    perFeedMlMax,
    workings,
  };
}

export function tempTargetForDay(day: number): TempTarget {
  let chosen = TEMP_TARGETS[0].target;
  for (const t of TEMP_TARGETS) if (day >= t.fromDay) chosen = t.target;
  return chosen;
}

export function formatTempTarget(t: TempTarget): string {
  return t.minC === t.maxC ? `${t.minC} °C` : `${t.minC}–${t.maxC} °C`;
}
