import type { CareEvent, Litter, Puppy, WeightEntry } from '../db/schema';
import { sha256Hex } from '../lib/hash';

export const PASSPORT_VERSION = 1;
export const MEMO_PREFIX = 'PGRAM1:';

/**
 * The passport is the artifact that gets hashed and anchored. Every field is
 * something the breeder typed; nothing here is derived, because derived values
 * would change if the rules changed and would break old seals.
 *
 * Timestamps are ISO-8601 strings rather than epoch numbers so the canonical
 * form has no integer/float ambiguity to get wrong.
 */
export interface Passport {
  v: number;
  breed: string;
  care: { at: string; kind: CareEvent['kind']; note: string }[];
  collar: string;
  dam: string;
  name: string;
  sex: 'M' | 'F';
  sire: string;
  weights: { at: string; g: number }[];
  whelpedAt: string;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function buildPassport(
  litter: Litter,
  puppy: Puppy,
  weights: WeightEntry[],
  care: CareEvent[]
): Passport {
  return {
    v: PASSPORT_VERSION,
    breed: litter.breed,
    care: care
      .filter((c) => c.puppyId === puppy.id || c.puppyId === undefined)
      .slice()
      .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind))
      .map((c) => ({ at: iso(c.at), kind: c.kind, note: c.note ?? '' })),
    collar: puppy.collar,
    dam: litter.damName,
    name: puppy.name ?? '',
    sex: puppy.sex,
    sire: litter.sireName ?? '',
    weights: weights
      .filter((w) => w.puppyId === puppy.id)
      .slice()
      .sort((a, b) => a.at - b.at || a.grams - b.grams)
      .map((w) => ({ at: iso(w.at), g: Math.round(w.grams) })),
    whelpedAt: iso(litter.whelpedAt),
  };
}

/**
 * Canonical JSON: keys sorted at every level, no whitespace, integers only.
 * The digest must be reproducible byte for byte on any machine, in any
 * browser, years later — so this deliberately does not use JSON.stringify's
 * default key order (which follows insertion order).
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('Cannot canonicalise a non-finite number');
    }
    // Integers only in a passport; this keeps 250 from ever becoming 250.0.
    return Number.isInteger(value as number)
      ? String(value)
      : String(Number((value as number).toPrecision(15)));
  }
  if (t === 'string' || t === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`;
  }
  throw new Error(`Cannot canonicalise ${t}`);
}

export async function passportDigest(p: Passport): Promise<string> {
  return sha256Hex(canonicalJson(p));
}

export function memoForDigest(digest: string): string {
  return `${MEMO_PREFIX}${digest}`;
}

export function digestFromMemo(memo: string): string | null {
  const trimmed = memo.trim();
  if (!trimmed.startsWith(MEMO_PREFIX)) return null;
  const digest = trimmed.slice(MEMO_PREFIX.length).trim();
  return /^[0-9a-f]{64}$/.test(digest) ? digest : null;
}

/* ------------------------------------------------------------------ */
/* Transport: passport + signature, compressed for a QR code           */
/* ------------------------------------------------------------------ */

export interface SealedBundle {
  passport: Passport;
  signature: string;
  cluster: 'devnet';
}

const b64urlEncode = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/**
 * Encodes a sealed bundle for the verify link / QR code. Gzipped because a
 * seven-puppy, eight-week passport is several kilobytes of very repetitive
 * JSON, and an uncompressed one will not fit in a scannable QR.
 */
export async function encodeBundle(bundle: SealedBundle): Promise<string> {
  return b64urlEncode(await gzip(canonicalJson(bundle)));
}

export async function decodeBundle(encoded: string): Promise<SealedBundle> {
  const json = await gunzip(b64urlDecode(encoded.trim()));
  const parsed = JSON.parse(json) as SealedBundle;
  if (!parsed?.passport || !parsed?.signature) {
    throw new Error('That code is not a Puppergram passport.');
  }
  return parsed;
}

/** QR codes top out around 2.9 KB; keep a margin for the URL prefix. */
export const QR_PAYLOAD_LIMIT = 2200;
