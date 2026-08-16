import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from '@solana/web3.js';
import { digestFromMemo } from '../logic/passport';

// @solana/web3.js still expects a Node Buffer global. Set here rather than in
// main.tsx so the polyfill ships in the lazy chain chunk, not the core bundle.
if (!(globalThis as unknown as { Buffer?: unknown }).Buffer) {
  (globalThis as unknown as { Buffer: unknown }).Buffer = Buffer;
}

/**
 * The chain is used as a timestamping notary, nothing more. We write one SPL
 * Memo containing `PGRAM1:<sha256>` and never anything else: no personal data,
 * no images, no token, no NFT. The hash proves the record has not been edited;
 * the block time proves when it was sealed.
 */

export const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

export const CLUSTER = 'devnet' as const;
export const PRIMARY_RPC = 'https://api.devnet.solana.com';

/** Optional second endpoint, tried only after the public one fails. */
const FALLBACK_RPC = (import.meta.env.VITE_SOLANA_RPC_FALLBACK ?? '').trim();

export function rpcEndpoints(): string[] {
  return FALLBACK_RPC ? [PRIMARY_RPC, FALLBACK_RPC] : [PRIMARY_RPC];
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function makeConnection(endpoint: string, commitment: Commitment = 'confirmed') {
  return new Connection(endpoint, commitment);
}

/* ------------------------------------------------------------------ */
/* Sealing                                                             */
/* ------------------------------------------------------------------ */

export function memoInstruction(payer: PublicKey, memo: string) {
  return new TransactionInstruction({
    // The memo program requires the signer as a read-only signer key for the
    // signature to be attributed on chain.
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf8'),
  });
}

export async function buildMemoTransaction(
  connection: Connection,
  payer: PublicKey,
  memo: string
): Promise<Transaction> {
  const tx = new Transaction().add(memoInstruction(payer, memo));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;
  return tx;
}

/* ------------------------------------------------------------------ */
/* Verification — must work with no wallet installed                   */
/* ------------------------------------------------------------------ */

export interface OnChainMemo {
  signature: string;
  digest: string | null;
  rawMemo: string | null;
  blockTime: number | null;
  slot: number | null;
  endpoint: string;
}

const MEMO_LOG = /Program log: Memo \(len \d+\): "([\s\S]*)"/;

function extractMemo(logs: string[] | null | undefined): string | null {
  if (!logs) return null;
  for (const line of logs) {
    const m = line.match(MEMO_LOG);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fetches the memo behind a transaction signature. Read-only: no wallet, no
 * key, no signing. This is the half of the flow a buyer actually uses.
 */
export async function fetchMemo(signature: string): Promise<OnChainMemo> {
  let lastError: unknown = null;

  for (const endpoint of rpcEndpoints()) {
    try {
      const connection = makeConnection(endpoint);
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx) {
        lastError = new Error('Transaction not found on devnet.');
        continue;
      }
      const raw = extractMemo(tx.meta?.logMessages);
      return {
        signature,
        rawMemo: raw,
        digest: raw ? digestFromMemo(raw) : null,
        blockTime: tx.blockTime ?? null,
        slot: tx.slot ?? null,
        endpoint,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('Could not reach any Solana devnet endpoint.');
}

export function isLikelySignature(s: string): boolean {
  // base58, 64 bytes -> 86-88 chars in practice
  return /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s.trim());
}

/* ------------------------------------------------------------------ */
/* Cached verdicts — verification must always render something         */
/* ------------------------------------------------------------------ */

const CACHE_KEY = 'puppergram.verify.cache.v1';

export interface CachedVerdict {
  signature: string;
  digest: string | null;
  match: boolean;
  blockTime: number | null;
  checkedAt: number;
}

export function cacheVerdict(v: CachedVerdict) {
  try {
    const all = readVerdictCache();
    all[v.signature] = v;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage may be full or blocked; the verdict is still on screen */
  }
}

export function readVerdictCache(): Record<string, CachedVerdict> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function cachedVerdict(signature: string): CachedVerdict | null {
  return readVerdictCache()[signature] ?? null;
}
