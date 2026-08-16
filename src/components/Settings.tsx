import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  backendLabel,
  canSpeak,
  currentBackend,
  onBackendChange,
  resolveBackend,
  speak,
  type Backend,
} from '../lib/voice';
import { clearAll, resetDemo } from '../db/seed';
import { RulesTable } from './RulesTable';
import { Wordmark } from './Wordmark';

export function Settings() {
  const navigate = useNavigate();
  const [backend, setBackend] = useState<Backend | null>(currentBackend());
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    void resolveBackend().then(setBackend);
    return onBackendChange(setBackend);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="tap -ml-2 px-2 text-sm text-muted hover:text-cream">
          ← Litter
        </Link>
        <Wordmark compact />
      </div>

      <h1 className="display mb-4 text-2xl text-cream">Settings</h1>

      <section className="card mb-3 px-4 py-4">
        <h2 className="display text-base text-cream">Voice</h2>
        <p className="mt-1 text-sm text-muted">
          Transcription: <span className="text-cream">{backendLabel(backend)}</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {backend === 'elevenlabs'
            ? 'Hold-to-talk is transcribed by ElevenLabs Scribe, through this site’s own server. No key is stored on your device and none is needed.'
            : backend === 'browser'
              ? 'Hold-to-talk uses your browser’s built-in recognition. It needs no account, and the keypad is always there as well.'
              : backend === 'none'
                ? 'This browser cannot transcribe speech. The keypad works exactly as well; it is just slower with one hand.'
                : 'Checking which transcription backend is available…'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Readback is always spoken by your device, so it keeps working with no
          signal and costs nothing.
        </p>
        <button
          type="button"
          onClick={() => void speak('Blue, two hundred and forty five grams, up eighteen. Good.')}
          disabled={!canSpeak()}
          className="tap mt-3 rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream disabled:opacity-40"
        >
          Test readback
        </button>
      </section>

      <section className="card mb-3 px-4 py-4">
        <h2 className="display text-base text-cream">Data</h2>
        <p className="mt-1 text-sm leading-snug text-muted">
          Everything is stored on this device only. There is no account and no
          server copy, so export each puppy's passport before you clear anything
          — that file is your backup.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await resetDemo();
              navigate('/');
            }}
            className="tap rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream"
          >
            Reset demo litter
          </button>

          {confirmWipe ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-alarm/40 bg-alarm/10 px-3 py-2">
              <p className="text-sm text-cream">
                This erases every litter, weight and seal on this device.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await clearAll();
                  navigate('/');
                }}
                className="tap rounded-lg bg-alarm px-4 py-2 text-sm font-semibold text-ink"
              >
                Erase everything
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="tap rounded-lg px-3 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="tap rounded-lg border border-alarm/40 px-4 py-2 text-sm text-alarm"
            >
              Erase all data
            </button>
          )}
        </div>
      </section>

      <RulesTable open />

      <section className="card mt-3 px-4 py-4">
        <h2 className="display text-base text-cream">Verify a passport</h2>
        <p className="mt-1 text-sm text-muted">
          Buyers can check a sealed record without installing anything — no
          wallet, no account.
        </p>
        <Link
          to="/verify"
          className="tap mt-2 inline-block rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream"
        >
          Open the verify page
        </Link>
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Puppergram — gram by gram, day by day.
        <br />A breeder's record-keeping tool, not veterinary advice.
      </p>
    </div>
  );
}
