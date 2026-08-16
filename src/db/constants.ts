import type { CollarColour } from './schema';

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Collar colours — the app's entire visual language                   */
/* ------------------------------------------------------------------ */

/**
 * `hex` is tuned to sit on the warm dark surface: it is the literal collar
 * colour, nudged for legibility rather than swapped for a palette colour.
 * `ring` marks collars that would otherwise vanish against the background.
 */
export const COLLARS: Record<
  CollarColour,
  { label: string; hex: string; ring?: boolean }
> = {
  blue: { label: 'Blue', hex: '#3D9BFF' },
  red: { label: 'Red', hex: '#FF4A4A' },
  green: { label: 'Green', hex: '#46D66B' },
  yellow: { label: 'Yellow', hex: '#FFD426' },
  purple: { label: 'Purple', hex: '#B473FF' },
  orange: { label: 'Orange', hex: '#FF9224' },
  pink: { label: 'Pink', hex: '#FF6FB0' },
  white: { label: 'White', hex: '#FFFFFF' },
  black: { label: 'Black', hex: '#5B5158', ring: true },
  grey: { label: 'Grey', hex: '#B3A7AE' },
};

export const COLLAR_ORDER: CollarColour[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'white',
  'black',
  'grey',
];

/* ------------------------------------------------------------------ */
/* Milestones, measured from the whelp timestamp                       */
/* ------------------------------------------------------------------ */

export type MilestoneKind =
  | 'deworming'
  | 'vaccination'
  | 'observation'
  | 'husbandry';

export interface MilestoneDef {
  id: string;
  /** Day the window opens. */
  day: number;
  /** Day the window closes; equals `day` for single-day events. */
  dayEnd?: number;
  title: string;
  detail: string;
  kind: MilestoneKind;
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: 'birth',
    day: 0,
    title: 'Birth',
    detail: 'Record birth weight. Ensure colostrum within 12–24 hours.',
    kind: 'husbandry',
  },
  {
    id: 'cord',
    day: 2,
    dayEnd: 4,
    title: 'Umbilical cord falls off',
    detail: 'Check the stump is clean and dry.',
    kind: 'observation',
  },
  {
    id: 'eyes',
    day: 10,
    dayEnd: 14,
    title: 'Eyes open',
    detail: 'Keep the box dim. Eyes open gradually and unevenly.',
    kind: 'observation',
  },
  {
    id: 'deworm-1',
    day: 14,
    title: 'First deworming',
    detail: 'Dose by current weight, not by age.',
    kind: 'deworming',
  },
  {
    id: 'ears',
    day: 14,
    dayEnd: 18,
    title: 'Ears open, hearing begins',
    detail: 'Puppies startle at sound for the first time.',
    kind: 'observation',
  },
  {
    id: 'teeth',
    day: 18,
    dayEnd: 21,
    title: 'Teeth erupt, first steps',
    detail: 'Needle teeth appear and the dam may start to wean.',
    kind: 'observation',
  },
  {
    id: 'water',
    day: 21,
    title: 'Introduce shallow water and gruel',
    detail: 'A shallow, non-tip dish. Supervise every session.',
    kind: 'husbandry',
  },
  {
    id: 'weaning',
    day: 21,
    dayEnd: 28,
    title: 'Weaning begins',
    detail: 'Expect the daily gain rate to slow as intake changes.',
    kind: 'husbandry',
  },
  {
    id: 'deworm-2',
    day: 28,
    title: 'Second deworming',
    detail: 'Re-dose by current weight.',
    kind: 'deworming',
  },
  {
    id: 'deworm-3',
    day: 42,
    title: 'Third deworming; weaning largely complete',
    detail: 'Re-dose by current weight.',
    kind: 'deworming',
  },
  {
    id: 'vacc-1',
    day: 42,
    dayEnd: 56,
    title: 'First vaccination (DHPP)',
    detail: 'Book with your vet. Timing depends on maternal antibody cover.',
    kind: 'vaccination',
  },
  {
    id: 'rehome',
    day: 56,
    title: 'Earliest rehoming',
    detail: 'Eight weeks. Seal each passport at handover.',
    kind: 'husbandry',
  },
];

/* ------------------------------------------------------------------ */
/* Ambient whelping-box temperature                                    */
/* ------------------------------------------------------------------ */

export interface TempTarget {
  weekLabel: string;
  minC: number;
  maxC: number;
}

export const TEMP_TARGETS: { fromDay: number; target: TempTarget }[] = [
  { fromDay: 0, target: { weekLabel: 'Week 1', minC: 29, maxC: 32 } },
  { fromDay: 7, target: { weekLabel: 'Week 2', minC: 26, maxC: 29 } },
  { fromDay: 14, target: { weekLabel: 'Weeks 3–4', minC: 24, maxC: 24 } },
  { fromDay: 28, target: { weekLabel: 'Week 5+', minC: 21, maxC: 21 } },
];

/* ------------------------------------------------------------------ */
/* Supplemental feeding                                                */
/* ------------------------------------------------------------------ */

/** Millilitres of formula per 100 g of body weight per day. */
export const ML_PER_100G_MIN = 15;
export const ML_PER_100G_MAX = 20;

export const FEED_SCHEDULE: {
  fromDay: number;
  feedsPerDay: number;
  intervalLabel: string;
}[] = [
  { fromDay: 0, feedsPerDay: 10, intervalLabel: 'every 2–3 hours' },
  { fromDay: 7, feedsPerDay: 7, intervalLabel: 'every 3–4 hours' },
  { fromDay: 14, feedsPerDay: 6, intervalLabel: 'every 4 hours' },
  { fromDay: 21, feedsPerDay: 5, intervalLabel: 'every 5 hours, alongside gruel' },
];

export const FEEDING_DISCLAIMER =
  'Guideline only. Confirm amounts with your vet.';

/* ------------------------------------------------------------------ */
/* Growth expectations                                                 */
/* ------------------------------------------------------------------ */

export const EXPECTED_DAILY_GAIN_MIN = 0.05; // 5%
export const EXPECTED_DAILY_GAIN_MAX = 0.1; // 10%
