import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  canonicalJson,
  decodeBundle,
  passportDigest,
  type Passport,
} from '../logic/passport';
import { prettyDigest } from '../lib/hash';
import {
  cacheVerdict,
  cachedVerdict,
  explorerTxUrl,
  fetchMemo,
  isLikelySignature,
} from '../lib/solana';
import { fmtDate, fmtDateTime } from '../lib/ui';

type Verdict =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | {
      kind: 'match' | 'mismatch';
      passport: Passport;
      localDigest: string;
      chainDigest: string | null;
      signature: string;
      blockTime: number | null;
    }
  | { kind: 'notfound'; signature: string; localDigest: string }
  | {
      kind: 'offline';
      signature: string;
      localDigest: string;
      cached: ReturnType<typeof cachedVerdict>;
    }
  | { kind: 'error'; message: string };

/**
 * Standalone and read-only. No wallet, no connection, no account — this is the
 * half of the flow a buyer actually uses, and it has to work for someone with
 * nothing installed.
 */
export function VerifyPage() {
  const [json, setJson] = useState('');
  const [signature, setSignature] = useState('');
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });

  const run = useCallback(async (passport: Passport, sig: string) => {
    setVerdict({ kind: 'checking' });
    const localDigest = await passportDigest(passport);

    try {
      const memo = await fetchMemo(sig);
      if (!memo.rawMemo) {
        setVerdict({ kind: 'notfound', signature: sig, localDigest });
        return;
      }
      const match = memo.digest === localDigest;
      cacheVerdict({
        signature: sig,
        digest: memo.digest,
        match,
        blockTime: memo.blockTime,
        checkedAt: Date.now(),
      });
      setVerdict({
        kind: match ? 'match' : 'mismatch',
        passport,
        localDigest,
        chainDigest: memo.digest,
        signature: sig,
        blockTime: memo.blockTime,
      });
    } catch {
      // RPC unreachable: show the cached verdict rather than an error.
      const cached = cachedVerdict(sig);
      if (cached) {
        setVerdict({ kind: 'offline', signature: sig, localDigest, cached });
      } else {
        setVerdict({
          kind: 'error',
          message:
            'Could not reach Solana devnet, and this record has not been checked on this device before. Try again when you have a connection.',
        });
      }
    }
  }, []);

  /* A scanned QR arrives as #p=<compressed bundle>. */
  useEffect(() => {
    const hash = window.location.hash;
    const m = hash.match(/[#&]p=([^&]+)/);
    if (!m) return;
    (async () => {
      try {
        const bundle = await decodeBundle(m[1]);
        setJson(canonicalJson(bundle.passport));
        setSignature(bundle.signature);
        await run(bundle.passport, bundle.signature);
      } catch {
        setVerdict({
          kind: 'error',
          message: 'That link does not contain a readable Puppergram passport.',
        });
      }
    })();
  }, [run]);

  function manualCheck() {
    let passport: Passport;
    try {
      passport = JSON.parse(json);
    } catch {
      setVerdict({ kind: 'error', message: 'That is not valid JSON.' });
      return;
    }
    if (!passport?.weights || !passport?.whelpedAt) {
      setVerdict({
        kind: 'error',
        message: 'That JSON is not a Puppergram passport.',
      });
      return;
    }
    if (!isLikelySignature(signature)) {
      setVerdict({
        kind: 'error',
        message: 'That does not look like a Solana transaction signature.',
      });
      return;
    }
    void run(passport, signature.trim());
  }

  const field =
    'w-full rounded-lg border border-cream/15 bg-surface px-3 py-2.5 text-cream placeholder:text-muted/60 focus:border-heat';

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <header className="mb-5">
        <h1 className="display text-2xl text-cream">Verify a growth passport</h1>
        <p className="mt-1 text-sm leading-snug text-muted">
          Checks a puppy's recorded growth history against a fingerprint written
          to Solana devnet at handover. If a single gram has been changed since
          then, this page says so.
        </p>
      </header>

      <VerdictPanel verdict={verdict} />

      <section className="card mt-4 px-4 py-4">
        <h2 className="display text-base text-cream">Check by paste</h2>
        <p className="mt-1 text-xs text-muted">
          Scanning the breeder's QR code fills this in for you.
        </p>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-muted">Passport JSON</span>
          <textarea
            className={`num ${field} h-32 resize-y text-[11px]`}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"v":1,"breed":"…","weights":[…]}'
            spellCheck={false}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-muted">Transaction signature</span>
          <input
            className={`num ${field} text-[11px]`}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="5Xw…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <button
          type="button"
          onClick={manualCheck}
          disabled={verdict.kind === 'checking'}
          className="tap mt-3 h-12 w-full rounded-xl bg-heat text-base font-semibold text-ink disabled:opacity-40"
        >
          {verdict.kind === 'checking' ? 'Checking devnet…' : 'Verify'}
        </button>
      </section>

      <p className="mt-4 text-center text-xs text-muted">
        <Link to="/" className="underline underline-offset-4">
          Puppergram
        </Link>{' '}
        — a breeder's record-keeping tool, not veterinary advice.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VerdictPanel({ verdict }: { verdict: Verdict }) {
  if (verdict.kind === 'idle') return null;

  if (verdict.kind === 'checking') {
    return (
      <div className="card px-4 py-4">
        <p className="text-sm text-muted">Reading the memo from Solana devnet…</p>
      </div>
    );
  }

  if (verdict.kind === 'error') {
    return (
      <div className="card border-caution/40 bg-caution/10 px-4 py-4" role="alert">
        <p className="text-sm font-semibold text-caution">
          <span aria-hidden>●</span> Cannot check
        </p>
        <p className="mt-1 text-sm text-cream">{verdict.message}</p>
      </div>
    );
  }

  if (verdict.kind === 'notfound') {
    return (
      <div className="card border-caution/40 bg-caution/10 px-4 py-4" role="alert">
        <p className="text-sm font-semibold text-caution">
          <span aria-hidden>●</span> No Puppergram seal on that transaction
        </p>
        <p className="mt-1 text-sm text-cream">
          The transaction exists but carries no passport fingerprint. Check you
          were given the right signature.
        </p>
      </div>
    );
  }

  if (verdict.kind === 'offline') {
    const c = verdict.cached!;
    return (
      <div className="card border-cream/20 px-4 py-4" role="status">
        <p className="text-sm font-semibold text-muted">
          <span aria-hidden>■</span> Showing the last known result
        </p>
        <p className="mt-1 text-sm text-cream">
          Solana devnet is unreachable right now. When this record was last
          checked, on {fmtDateTime(c.checkedAt)}, it{' '}
          {c.match ? 'matched' : 'did not match'} the chain.
        </p>
      </div>
    );
  }

  const ok = verdict.kind === 'match';
  const p = verdict.passport;

  return (
    <div
      className={`card px-4 py-4 ${ok ? 'border-good/40 bg-good/8' : 'border-alarm/50 bg-alarm/10'}`}
      role="alert"
    >
      <p className={`text-base font-semibold ${ok ? 'text-good' : 'text-alarm'}`}>
        <span aria-hidden>{ok ? '✓' : '▲'}</span>{' '}
        {ok ? 'Record verified' : 'Record does not match'}
      </p>

      <p className="mt-1 text-sm leading-snug text-cream">
        {ok ? (
          <>
            This growth record is byte-for-byte identical to the one sealed on
            {verdict.blockTime
              ? ` ${fmtDate(verdict.blockTime * 1000)}`
              : ' devnet'}
            . It has not been edited since.
          </>
        ) : (
          <>
            This record has been altered since it was sealed. The fingerprint on
            chain describes a different set of weights. Ask the breeder for the
            original.
          </>
        )}
      </p>

      <dl className="mt-3 space-y-2 border-t border-cream/10 pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Puppy</dt>
          <dd className="text-cream">
            {p.collar}
            {p.name ? ` · ${p.name}` : ''} · {p.sex === 'F' ? 'Female' : 'Male'} ·{' '}
            {p.breed}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Dam and sire</dt>
          <dd className="text-cream">
            {p.dam}
            {p.sire ? ` × ${p.sire}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Whelped</dt>
          <dd className="num text-cream">{fmtDate(new Date(p.whelpedAt).getTime())}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Weights in this record</dt>
          <dd className="num text-cream">
            {p.weights.length} entries, {p.weights[0]?.g ?? '—'} g to{' '}
            {p.weights[p.weights.length - 1]?.g ?? '—'} g
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Fingerprint of this record</dt>
          <dd className="num break-all text-[11px] text-cream">
            {prettyDigest(verdict.localDigest)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Fingerprint on chain</dt>
          <dd
            className={`num break-all text-[11px] ${ok ? 'text-cream' : 'text-alarm'}`}
          >
            {verdict.chainDigest ? prettyDigest(verdict.chainDigest) : '—'}
          </dd>
        </div>
      </dl>

      <a
        href={explorerTxUrl(verdict.signature)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-sm text-heat underline underline-offset-4"
      >
        View the transaction on Solana Explorer →
      </a>
    </div>
  );
}
