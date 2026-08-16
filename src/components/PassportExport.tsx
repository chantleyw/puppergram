import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { db } from '../db/schema';
import {
  QR_PAYLOAD_LIMIT,
  buildPassport,
  canonicalJson,
  encodeBundle,
  passportDigest,
  type Passport,
} from '../logic/passport';
import { prettyDigest } from '../lib/hash';
import { collarHex, fmtDate, fmtDateTime } from '../lib/ui';
import { ChainAnchor } from './ChainAnchor';
import { SolanaProviders } from './SolanaProviders';
import { useSeals } from '../hooks/useLitterView';
import { COLLARS } from '../db/constants';

/**
 * The record handed over at eight weeks. Printable as the buyer's paper copy,
 * exportable as JSON — which doubles as the breeder's only backup, since
 * nothing is stored off this device — and sealable on chain so the buyer can
 * check it has not been edited since.
 */
export function PassportExport() {
  const puppyId = Number(useParams().puppyId);
  const seals = useSeals(puppyId);

  const data = useLiveQuery(async () => {
    const puppy = await db.puppies.get(puppyId);
    if (!puppy) return null;
    const litter = await db.litters.get(puppy.litterId);
    if (!litter) return null;
    const weights = await db.weights.where({ puppyId }).sortBy('at');
    const care = await db.care.where({ litterId: puppy.litterId }).toArray();
    return { puppy, litter, weights, care };
  }, [puppyId]);

  const passport: Passport | null = useMemo(
    () => (data ? buildPassport(data.litter, data.puppy, data.weights, data.care) : null),
    [data]
  );

  const [digest, setDigest] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrTooBig, setQrTooBig] = useState(false);

  useEffect(() => {
    if (!passport) return;
    let cancelled = false;
    void passportDigest(passport).then((d) => !cancelled && setDigest(d));
    return () => {
      cancelled = true;
    };
  }, [passport]);

  const latestSeal = seals?.[0];

  /* The QR carries the passport and its signature, so a buyer with no copy of
     the app's data can still verify. */
  useEffect(() => {
    if (!passport || !latestSeal) {
      setQr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const encoded = await encodeBundle({
        passport,
        signature: latestSeal.signature,
        cluster: 'devnet',
      });
      if (cancelled) return;
      if (encoded.length > QR_PAYLOAD_LIMIT) {
        setQrTooBig(true);
        setQr(null);
        return;
      }
      setQrTooBig(false);
      const url = `${window.location.origin}/verify#p=${encoded}`;
      const png = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'L',
        margin: 1,
        width: 320,
        color: { dark: '#171019', light: '#F8EDE4' },
      });
      if (!cancelled) setQr(png);
    })().catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [passport, latestSeal]);

  if (data === undefined) return <p className="p-6 text-sm text-muted">Loading…</p>;
  if (!data || !passport)
    return (
      <div className="p-6">
        <p className="text-sm text-muted">That puppy is not on this device.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-heat underline">
          Back to the litter
        </Link>
      </div>
    );

  const { puppy, litter, weights } = data;
  const accent = collarHex(puppy.collar);

  function downloadJson() {
    const blob = new Blob([canonicalJson(passport, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `puppergram-${puppy.collar}-${litter.damName.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link to={`/puppy/${puppyId}`} className="tap text-sm text-muted hover:text-cream">
          ← Back
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="tap rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream"
          >
            Print / PDF
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="tap gradient-action rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Download JSON
          </button>
        </div>
      </div>

      <article className="card px-5 py-5 print-block">
        <header className="flex items-start gap-3 border-b border-cream/10 pb-4">
          <span
            aria-hidden
            className="mt-1 h-12 w-2 shrink-0 rounded-full"
            style={{ background: accent, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Puppergram growth passport
            </p>
            <h1 className="display text-2xl text-cream">
              {COLLARS[puppy.collar].label}
              {puppy.name ? ` · ${puppy.name}` : ''}
            </h1>
            <p className="text-sm text-muted">
              {puppy.sex === 'F' ? 'Female' : 'Male'} · {litter.breed}
            </p>
          </div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Dam (mother)</dt>
            <dd className="text-cream">{litter.damName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Sire (father)</dt>
            <dd className="text-cream">{litter.sireName || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Whelped</dt>
            <dd className="num text-cream">{fmtDate(litter.whelpedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Weights recorded</dt>
            <dd className="num text-cream">{weights.length}</dd>
          </div>
        </dl>

        <h2 className="mt-5 text-xs uppercase tracking-wide text-muted">Weight series</h2>
        <table className="mt-1.5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream/10 text-left">
              <th className="py-1 text-xs font-medium text-muted">Recorded</th>
              <th className="py-1 text-right text-xs font-medium text-muted">Grams</th>
              <th className="py-1 text-right text-xs font-medium text-muted">Change</th>
            </tr>
          </thead>
          <tbody>
            {weights.map((w, i) => {
              const prev = i > 0 ? weights[i - 1].grams : null;
              const delta = prev === null ? null : w.grams - prev;
              return (
                <tr key={w.id} className="border-b border-cream/5 last:border-0">
                  <td className="num py-1 text-cream">{fmtDateTime(w.at)}</td>
                  <td className="num py-1 text-right text-cream">{w.grams}</td>
                  <td className="num py-1 text-right text-muted">
                    {delta === null ? '—' : delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {passport.care.length > 0 && (
          <>
            <h2 className="mt-5 text-xs uppercase tracking-wide text-muted">Care events</h2>
            <ul className="mt-1.5 space-y-1 text-sm">
              {passport.care.map((c, i) => (
                <li key={i} className="flex gap-2 border-b border-cream/5 py-1 last:border-0">
                  <span className="num shrink-0 text-muted">
                    {fmtDate(new Date(c.at).getTime())}
                  </span>
                  <span className="text-cream capitalize">{c.kind}</span>
                  <span className="text-muted">{c.note}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-5 border-t border-cream/10 pt-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            SHA-256 fingerprint
          </p>
          <p className="num mt-1 break-all text-[11px] leading-relaxed text-cream">
            {digest ? prettyDigest(digest) : 'computing…'}
          </p>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          This is a breeder's record, not veterinary advice or a health
          certificate. It records what was weighed and when.
        </p>
      </article>

      {(qr || qrTooBig) && (
        <section className="card mt-4 px-5 py-4 print-block">
          <h2 className="display text-lg text-cream">Give this to the buyer</h2>
          {qr ? (
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <img
                src={qr}
                alt="QR code containing this passport and its transaction signature"
                className="h-40 w-40 rounded-lg"
              />
              <p className="max-w-sm text-sm text-muted">
                Scanning this opens the verify page with the full record and its
                signature already filled in. No app, no wallet, no account
                needed to check it.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              This record is now too long to fit in a scannable QR code. Use
              Download JSON and hand over the file plus the transaction
              signature instead — the verify page accepts both by paste.
            </p>
          )}
        </section>
      )}

      <section className="card no-print mt-4 px-5 py-4">
        <h2 className="display text-base text-cream">Keep a copy</h2>
        <p className="mt-1 text-sm leading-snug text-muted">
          Nothing is stored off this device. Download the JSON before clearing
          data or changing browser — that file is your only backup, and it is
          the copy worth handing to the buyer alongside the printed record.
        </p>
      </section>

      <div className="mt-4">
        <SolanaProviders>
          <ChainAnchor puppyId={puppyId} digest={digest} />
        </SolanaProviders>
      </div>
    </div>
  );
}
