import Dexie, { type Table } from 'dexie';

export interface Litter {
  id?: number;
  damName: string;
  sireName?: string;
  breed: string;
  whelpedAt: number; // epoch ms
}

export interface Puppy {
  id?: number;
  litterId: number;
  collar: CollarColour; // primary identity
  name?: string;
  sex: 'M' | 'F';
}

export interface WeightEntry {
  id?: number;
  puppyId: number;
  at: number; // epoch ms
  grams: number;
  source: 'manual' | 'voice';
}

export interface CareEvent {
  id?: number;
  puppyId?: number; // undefined = whole litter
  litterId: number;
  kind: 'deworming' | 'vaccination' | 'vet' | 'note';
  at: number;
  note?: string;
}

/**
 * Eighteen collars. Large litters happen — a Labrador can throw twelve and
 * the record is over twenty — so running out of collars mid-whelp is a real
 * failure, not a theoretical one.
 */
/**
 * A sealed passport: the SHA-256 digest of the canonical passport JSON at the
 * moment of sealing, plus the Solana devnet transaction that anchors it.
 * Stored locally only; the chain holds nothing but the hash.
 */
export interface Seal {
  id?: number;
  puppyId: number;
  digest: string; // 64-char lowercase hex
  signature: string; // Solana tx signature
  sealedAt: number;
  cluster: 'devnet';
}

export type CollarColour =
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'white'
  | 'black'
  | 'grey'
  | 'teal'
  | 'brown'
  | 'lime'
  | 'maroon'
  | 'navy'
  | 'lavender'
  | 'cream'
  | 'silver';

export class PuppergramDB extends Dexie {
  litters!: Table<Litter, number>;
  puppies!: Table<Puppy, number>;
  weights!: Table<WeightEntry, number>;
  care!: Table<CareEvent, number>;
  seals!: Table<Seal, number>;

  constructor() {
    super('puppergram');
    this.version(1).stores({
      litters: '++id, whelpedAt',
      puppies: '++id, litterId, collar',
      weights: '++id, puppyId, at, [puppyId+at]',
      care: '++id, litterId, puppyId, at',
    });
    this.version(2).stores({
      litters: '++id, whelpedAt',
      puppies: '++id, litterId, collar',
      weights: '++id, puppyId, at, [puppyId+at]',
      care: '++id, litterId, puppyId, at',
      seals: '++id, puppyId, sealedAt',
    });
  }
}

export const db = new PuppergramDB();
