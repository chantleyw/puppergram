import type { CollarColour } from '../db/schema';
import { COLLAR_ORDER } from '../db/constants';

/**
 * Turns a transcript into { collar, grams }.
 *
 * Breeders do not speak like a form. At 3am the phrasing is "blue two forty
 * five", not "two hundred and forty five grams for the blue puppy". This
 * parser accepts digits, spoken compounds, and digit-by-digit readings, and
 * reports its own confidence so the UI can always show a correction chip.
 */

export interface ParseResult {
  collar: CollarColour | null;
  grams: number | null;
  confidence: 'high' | 'low';
  transcript: string;
  /** Why the parse is unusable, when it is. */
  problem?: string;
}

/** A neonate through to an eight-week giant breed. Anything outside is a slip. */
export const MIN_GRAMS = 50;
export const MAX_GRAMS = 20000;

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, nought: 0,
  one: 1, won: 1,
  two: 2, to: 2, too: 2,
  three: 3, tree: 3,
  four: 4, for: 4, fore: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8, ate: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40, fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Words that sound like a collar colour to a speech engine. */
const COLLAR_ALIASES: Record<string, CollarColour> = {
  blue: 'blue', blu: 'blue',
  red: 'red', read: 'red',
  green: 'green',
  yellow: 'yellow', yello: 'yellow',
  purple: 'purple', violet: 'purple',
  orange: 'orange',
  pink: 'pink',
  white: 'white', wight: 'white',
  black: 'black',
  grey: 'grey', gray: 'grey',
};

type Tok =
  | { t: 'unit'; v: number }
  | { t: 'ten'; v: number }
  | { t: 'digits'; v: number; raw: string }
  | { t: 'hundred' }
  | { t: 'thousand' }
  | { t: 'skip' };

function tokenize(words: string[]): Tok[] {
  const out: Tok[] = [];
  for (const word of words) {
    if (word in UNITS) out.push({ t: 'unit', v: UNITS[word] });
    else if (word in TENS) out.push({ t: 'ten', v: TENS[word] });
    else if (word === 'hundred' || word === 'hundreds') out.push({ t: 'hundred' });
    else if (word === 'thousand' || word === 'thousands') out.push({ t: 'thousand' });
    else if (/^\d+$/.test(word))
      out.push({ t: 'digits', v: parseInt(word, 10), raw: word });
    else if (word === 'and' || word === 'point') out.push({ t: 'skip' });
    else out.push({ t: 'skip' });
  }
  return out;
}

/**
 * Combines a run of number tokens into one value.
 *
 * The interesting case is the elided hundred: "two forty five" means 245, so a
 * single digit followed by a tens word is read as hundreds + tens.
 */
function combine(tokens: Tok[]): number | null {
  const nums = tokens.filter((t) => t.t !== 'skip');
  if (nums.length === 0) return null;

  // "two four five" — three or more bare digits read one at a time.
  const allSingleDigits = nums.every(
    (t) =>
      (t.t === 'unit' && t.v <= 9) || (t.t === 'digits' && t.raw.length === 1)
  );
  if (allSingleDigits && nums.length >= 3) {
    const joined = nums
      .map((t) => String((t as { v: number }).v))
      .join('');
    return parseInt(joined, 10);
  }

  let total = 0;
  let current = 0;

  for (const tok of nums) {
    switch (tok.t) {
      case 'hundred':
        current = (current || 1) * 100;
        break;
      case 'thousand':
        total += (current || 1) * 1000;
        current = 0;
        break;
      case 'digits':
      case 'unit':
      case 'ten': {
        const v = tok.v;
        if (v >= 100) {
          // A fully spoken number like "245" or "1200".
          total += current;
          current = v;
        } else if (current === 0) {
          current = v;
        } else if (current <= 9 && v >= 10 && v <= 99) {
          // The elided hundred: "two forty" -> 240, "one ten" -> 110.
          current = current * 100 + v;
        } else if (current % 100 === 0 && current > 0) {
          // "two hundred" + "forty" -> 240
          current += v;
        } else if (current >= 20 && current % 10 === 0 && v <= 9) {
          // "forty" + "five" -> 45
          current += v;
        } else if (current >= 100 && v < 100) {
          current += v;
        } else {
          // Two unrelated numbers; the later one wins.
          total += current;
          current = v;
        }
        break;
      }
      default:
        break;
    }
  }
  return total + current;
}

export function parseSpeech(
  transcript: string,
  allowed: CollarColour[] = COLLAR_ORDER
): ParseResult {
  const cleaned = transcript
    .toLowerCase()
    // Grams are whole numbers, so a decimal tail is noise, not precision.
    .replace(/(\d)\.(\d+)/g, '$1')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/(\d)\s*(?:g|gs|grams?|gram)\b/g, '$1 ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);

  /* --- collar --- */
  let collar: CollarColour | null = null;
  for (const word of words) {
    const hit = COLLAR_ALIASES[word];
    if (hit && allowed.includes(hit)) {
      collar = hit;
      break;
    }
  }

  /* --- number: take the token run after the collar word --- */
  const collarIdx = collar
    ? words.findIndex((w) => COLLAR_ALIASES[w] === collar)
    : -1;
  const numberWords = collarIdx >= 0 ? words.slice(collarIdx + 1) : words;

  let grams = combine(tokenize(numberWords));
  if (grams === null && collarIdx >= 0) {
    // The number may have come before the colour: "245 blue".
    grams = combine(tokenize(words.slice(0, collarIdx)));
  }

  const problem =
    grams !== null && (grams < MIN_GRAMS || grams > MAX_GRAMS)
      ? `${grams} g is outside the plausible range (${MIN_GRAMS}–${MAX_GRAMS} g).`
      : undefined;

  if (problem) grams = null;

  const confidence: 'high' | 'low' =
    collar && grams !== null ? 'high' : 'low';

  return {
    collar,
    grams,
    confidence,
    transcript: transcript.trim(),
    problem:
      problem ??
      (!collar && grams === null
        ? 'No collar colour or weight heard.'
        : !collar
          ? 'No collar colour heard.'
          : grams === null
            ? 'No weight heard.'
            : undefined),
  };
}

/** Digits only, for the "correct this parse" chip. */
export function parseGramsOnly(transcript: string): number | null {
  const r = combine(
    tokenize(
      transcript
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/-/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    )
  );
  return r === null || r < MIN_GRAMS || r > MAX_GRAMS ? null : r;
}
