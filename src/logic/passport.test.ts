import { describe, it, expect } from 'vitest';
import {
  buildPassport,
  canonicalJson,
  decodeBundle,
  digestFromMemo,
  encodeBundle,
  memoForDigest,
  passportDigest,
} from './passport';
import type { CareEvent, Litter, Puppy, WeightEntry } from '../db/schema';

const WHELPED = new Date('2026-08-01T00:00:00Z').getTime();

const litter: Litter = {
  id: 1,
  damName: 'Nala',
  sireName: 'Bruno',
  breed: 'Labrador Retriever',
  whelpedAt: WHELPED,
};

const puppy: Puppy = { id: 7, litterId: 1, collar: 'green', name: 'Gorse', sex: 'F' };

const weights: WeightEntry[] = [
  { id: 1, puppyId: 7, at: WHELPED, grams: 380, source: 'manual' },
  { id: 2, puppyId: 7, at: WHELPED + 86_400_000, grams: 408, source: 'voice' },
  { id: 3, puppyId: 7, at: WHELPED + 172_800_000, grams: 438, source: 'voice' },
  // Another puppy's weight, which must not leak into this passport.
  { id: 4, puppyId: 9, at: WHELPED, grams: 999, source: 'manual' },
];

const care: CareEvent[] = [
  { id: 1, litterId: 1, puppyId: 7, kind: 'note', at: WHELPED + 1000, note: 'Slow to latch' },
];

const passport = buildPassport(litter, puppy, weights, care);

describe('canonical JSON', () => {
  it('sorts keys at every level, so the bytes do not depend on insertion order', () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('emits no structural whitespace', () => {
    // Whitespace inside a string value is content and must survive; what must
    // not appear is any padding between tokens.
    expect(canonicalJson({ b: 1, a: [1, 2], c: { d: 'x' } })).toBe(
      '{"a":[1,2],"b":1,"c":{"d":"x"}}'
    );
    expect(canonicalJson(passport)).not.toMatch(/[\n\r\t]/);
  });

  it('keeps integers as integers', () => {
    expect(canonicalJson({ g: 250 })).toBe('{"g":250}');
  });

  it('drops undefined rather than emitting it', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('refuses non-finite numbers instead of writing null', () => {
    expect(() => canonicalJson({ n: NaN })).toThrow();
    expect(() => canonicalJson({ n: Infinity })).toThrow();
  });
});

describe('passport contents', () => {
  it('includes only this puppy\'s weights', () => {
    expect(passport.weights).toHaveLength(3);
    expect(passport.weights.map((w) => w.g)).toEqual([380, 408, 438]);
  });

  it('records timestamps as ISO strings, not epoch numbers', () => {
    expect(passport.whelpedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('carries identity, parentage and breed', () => {
    expect(passport).toMatchObject({
      collar: 'green',
      name: 'Gorse',
      sex: 'F',
      dam: 'Nala',
      sire: 'Bruno',
      breed: 'Labrador Retriever',
    });
  });
});

describe('the digest', () => {
  it('is 64 lowercase hex characters', async () => {
    const d = await passportDigest(passport);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is reproducible for the same record', async () => {
    const again = buildPassport(litter, puppy, weights, care);
    expect(await passportDigest(passport)).toBe(await passportDigest(again));
  });

  it('does not depend on the order weights come out of the database', async () => {
    const shuffled = [weights[2], weights[0], weights[3], weights[1]];
    const p = buildPassport(litter, puppy, shuffled, care);
    expect(await passportDigest(p)).toBe(await passportDigest(passport));
  });

  /* This is the whole point of the feature. */
  it('changes when a single gram is edited', async () => {
    const tampered = weights.map((w) =>
      w.id === 2 ? { ...w, grams: 409 } : w
    );
    const p = buildPassport(litter, puppy, tampered, care);
    expect(await passportDigest(p)).not.toBe(await passportDigest(passport));
  });

  it('changes when a weight is deleted', async () => {
    const p = buildPassport(litter, puppy, weights.slice(1), care);
    expect(await passportDigest(p)).not.toBe(await passportDigest(passport));
  });

  it('changes when a care event is added', async () => {
    const p = buildPassport(litter, puppy, weights, [
      ...care,
      { id: 2, litterId: 1, puppyId: 7, kind: 'vet', at: WHELPED + 2000 },
    ]);
    expect(await passportDigest(p)).not.toBe(await passportDigest(passport));
  });
});

describe('the memo', () => {
  it('round-trips through the PGRAM1 prefix', async () => {
    const d = await passportDigest(passport);
    expect(digestFromMemo(memoForDigest(d))).toBe(d);
  });

  it('ignores memos that are not ours', () => {
    expect(digestFromMemo('hello world')).toBeNull();
    expect(digestFromMemo('PGRAM1:not-a-digest')).toBeNull();
  });

  it('tolerates surrounding whitespace from the chain', async () => {
    const d = await passportDigest(passport);
    expect(digestFromMemo(`  ${memoForDigest(d)}  `)).toBe(d);
  });
});

describe('the QR bundle', () => {
  it('survives a compress/encode/decode round trip', async () => {
    const encoded = await encodeBundle({
      passport,
      signature: 'sig123',
      cluster: 'devnet',
    });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, URL-safe
    const back = await decodeBundle(encoded);
    expect(back.signature).toBe('sig123');
    expect(await passportDigest(back.passport)).toBe(await passportDigest(passport));
  });

  it('rejects something that is not a passport', async () => {
    const encoded = await encodeBundle({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      passport: undefined as any,
      signature: '',
      cluster: 'devnet',
    });
    await expect(decodeBundle(encoded)).rejects.toThrow();
  });
});
