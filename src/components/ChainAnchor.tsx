import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { db } from '../db/schema';
import { buildMemoTransaction, explorerTxUrl } from '../lib/solana';
import { memoForDigest } from '../logic/passport';
import { shortDigest } from '../lib/hash';
import { fmtDateTime } from '../lib/ui';
import { useSeals } from '../hooks/useLitterView';

/**
 * Seals a passport by writing one SPL Memo containing `PGRAM1:<sha256>` to
 * Solana devnet. Nothing else goes on chain — no name, no photo, no token.
 *
 * Sealing is allowed to fail loudly. Verification is the half that must always
 * work, and it needs no wallet at all.
 */
export function ChainAnchor({
  puppyId,
  digest,
}: {
  puppyId: number;
  digest: string | null;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const seals = useSeals(puppyId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = seals?.[0];
  const stale = latest && digest && latest.digest !== digest;

  const seal = useCallback(async () => {
    if (!publicKey || !digest) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await buildMemoTransaction(connection, publicKey, memoForDigest(digest));
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      await db.seals.add({
        puppyId,
        digest,
        signature,
        sealedAt: Date.now(),
        cluster: 'devnet',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /insufficient|0x1\b/i.test(msg)
          ? 'That wallet has no devnet SOL. Airdrop some at faucet.solana.com, then try again.'
          : /reject|denied|user/i.test(msg)
            ? 'Signing was cancelled.'
            : `Could not seal: ${msg}`
      );
    } finally {
      setBusy(false);
    }
  }, [connection, publicKey, sendTransaction, digest, puppyId]);

  return (
    <section className="card px-4 py-4">
      <h2 className="display text-lg text-cream">Seal on chain</h2>
      <p className="mt-1 text-sm leading-snug text-muted">
        Writes this passport's SHA-256 fingerprint to Solana devnet as a
        timestamped memo. A buyer can then check the record has not been edited
        since handover. No personal data and no images go on chain.
      </p>

      {latest && (
        <div className="mt-3 rounded-lg border border-good/30 bg-good/5 px-3 py-2.5 print-block">
          <p className="text-sm font-medium text-good">
            <span aria-hidden>✓</span> Sealed {fmtDateTime(latest.sealedAt)}
          </p>
          <p className="num mt-1 break-all text-[11px] text-muted">
            {shortDigest(latest.digest)}
          </p>
          <a
            href={explorerTxUrl(latest.signature)}
            target="_blank"
            rel="noreferrer"
            className="num mt-1 block break-all text-[11px] text-heat underline"
          >
            {latest.signature}
          </a>
          {stale && (
            <p className="mt-2 text-xs text-caution">
              <span aria-hidden>●</span> This record has changed since it was
              sealed. Seal again to anchor the current version.
            </p>
          )}
        </div>
      )}

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <WalletMultiButton />
        <button
          type="button"
          onClick={seal}
          disabled={!connected || !digest || busy}
          className="tap rounded-lg bg-heat px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? 'Sealing…' : latest ? 'Seal again' : 'Seal passport'}
        </button>
      </div>

      {!connected && (
        <p className="no-print mt-2 text-xs text-muted">
          Connect a wallet set to devnet. Sealing is a once-per-puppy action at
          handover, so it is best done on a desktop or Android device.
        </p>
      )}

      {error && (
        <p className="no-print mt-2 rounded-lg border border-alarm/40 bg-alarm/10 px-3 py-2 text-sm text-cream">
          {error}
        </p>
      )}
    </section>
  );
}
