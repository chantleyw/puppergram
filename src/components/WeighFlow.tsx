import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import { COLLAR_ORDER } from '../db/constants';
import { loadLitterView, useLitterView } from '../hooks/useLitterView';
import { weighReadback } from '../logic/readback';
import { parseSpeech, type ParseResult } from '../lib/parseSpeech';
import { speak } from '../lib/voice';
import { collarHex, fmtDelta, relativeTime } from '../lib/ui';
import { VoiceButton } from './VoiceButton';
import type { PuppyView } from '../logic/triage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

export function WeighFlow({ litterId }: { litterId: number }) {
  const view = useLitterView(litterId);
  const navigate = useNavigate();

  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  /* Puppies in collar order — the order the yarn is tied, so the user can
     work along the box without reading anything. */
  const ordered = useMemo(() => {
    if (!view) return [];
    return [...view.puppies].sort(
      (a, b) =>
        COLLAR_ORDER.indexOf(a.puppy.collar) - COLLAR_ORDER.indexOf(b.puppy.collar)
    );
  }, [view]);

  const current: PuppyView | undefined = ordered[index];

  const commit = useCallback(
    async (puppyId: number, grams: number, source: 'manual' | 'voice') => {
      await db.weights.add({ puppyId, at: Date.now(), grams, source });

      // Re-derive from the same pure function that drives the screen, so the
      // spoken line and the visible alert can never disagree.
      const fresh = await loadLitterView(litterId);
      const p = fresh?.puppies.find((x) => x.id === puppyId);
      if (p) {
        const line = weighReadback(p);
        setSaved(line);
        void speak(line);
      }

      setEntry('');
      setPending(null);
      setMessage(null);
      setIndex((i) => (i + 1 < ordered.length ? i + 1 : i));
    },
    [litterId, ordered.length]
  );

  const onTranscript = useCallback(
    (text: string) => {
      if (!view) return;
      const allowed = view.puppies.map((p) => p.puppy.collar);
      const result = parseSpeech(text, allowed);
      setMessage(null);
      if (result.grams === null && result.collar === null) {
        setMessage(
          text.trim()
            ? `Heard "${text.trim()}" — no collar or weight in that. Try again or use the keypad.`
            : 'Nothing heard. Hold the button while you speak.'
        );
        return;
      }
      setPending(result);
    },
    [view]
  );

  /* Physical keyboard support, for the desktop matrix workflow. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending) return;
      if (/^\d$/.test(e.key)) setEntry((s) => (s.length < 5 ? s + e.key : s));
      else if (e.key === 'Backspace') setEntry((s) => s.slice(0, -1));
      else if (e.key === 'Enter' && entry && current) {
        void commit(current.id, parseInt(entry, 10), 'manual');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, current, pending, commit]);

  if (!view) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }
  if (ordered.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">This litter has no puppies yet.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-heat underline">
          Back to the litter
        </Link>
      </div>
    );
  }
  if (!current) return null;

  const accent = collarHex(current.puppy.collar);
  const typed = entry ? parseInt(entry, 10) : null;

  const pendingPuppy =
    pending?.collar && pending.collar !== current.puppy.collar
      ? ordered.find((p) => p.puppy.collar === pending.collar)
      : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink">
      {/* Header, tinted to the current puppy's collar */}
      <header
        className="shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ background: `linear-gradient(180deg, ${accent}26, transparent)` }}
      >
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="tap -ml-2 flex items-center px-2 text-sm text-muted hover:text-cream"
          >
            ← Done
          </Link>
          <p className="num text-xs text-muted">
            {index + 1} of {ordered.length}
          </p>
        </div>

        <div className="mt-2 flex items-baseline gap-3">
          <span
            aria-hidden
            className="h-7 w-2 shrink-0 rounded-full"
            style={{
              background: accent,
              boxShadow: 'inset 0 0 0 1px rgba(237,227,216,0.35)',
            }}
          />
          <h1 className="display text-3xl leading-none text-cream">{current.label}</h1>
        </div>

        <p className="num mt-1.5 text-xs text-muted">
          {current.latest
            ? `Last ${current.latest.grams} g, ${relativeTime(current.latest.at, view.now)}`
            : 'No previous weight'}
          {current.expectedNext &&
            ` · expect ${current.expectedNext.min}–${current.expectedNext.max} g`}
        </p>
      </header>

      {/* The number */}
      <div className="flex min-h-[92px] shrink-0 items-center justify-center px-4">
        <p
          className={`num text-6xl font-semibold tabular-nums ${
            typed === null ? 'text-muted/30' : 'text-cream'
          }`}
          aria-live="polite"
        >
          {typed === null ? '—' : typed}
          <span className="ml-2 text-2xl text-muted">g</span>
        </p>
      </div>

      {/* Voice parse confirmation — never commits without a tap */}
      {pending && (
        <div className="mx-4 mb-3 rounded-xl border border-heat/40 bg-heat/10 px-3 py-2.5">
          <p className="text-xs text-muted">
            Heard “{pending.transcript}”
          </p>
          <p className="num mt-1 text-lg text-cream">
            {pending.collar
              ? pending.collar.charAt(0).toUpperCase() + pending.collar.slice(1)
              : current.label}
            {' · '}
            {pending.grams ?? '—'} g
          </p>
          {pending.problem && (
            <p className="mt-1 text-xs text-caution">{pending.problem}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {pending.grams !== null && (
              <button
                type="button"
                onClick={() =>
                  commit(
                    (pendingPuppy ?? current).id,
                    pending.grams!,
                    'voice'
                  )
                }
                className="tap rounded-lg bg-heat px-4 text-sm font-semibold text-ink"
              >
                Save{pendingPuppy ? ` to ${pendingPuppy.label}` : ''}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEntry(pending.grams !== null ? String(pending.grams) : '');
                setPending(null);
              }}
              className="tap rounded-lg border border-cream/20 px-4 text-sm text-cream"
            >
              Correct
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="tap rounded-lg px-3 text-sm text-muted"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mx-4 mb-2 text-sm text-caution" role="status">
          {message}
        </p>
      )}
      {saved && !pending && !message && (
        <p className="mx-4 mb-2 text-sm text-good" role="status" aria-live="polite">
          {saved}
        </p>
      )}

      {/* Keypad */}
      <div className="mt-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex justify-center">
          <VoiceButton
            onTranscript={onTranscript}
            onError={(m) => setMessage(m)}
            hint="Hold to speak"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === 'del') setEntry((s) => s.slice(0, -1));
                else if (k === 'clear') setEntry('');
                else setEntry((s) => (s.length < 5 ? s + k : s));
              }}
              aria-label={k === 'del' ? 'Delete' : k === 'clear' ? 'Clear' : k}
              className="num tap h-[15vh] max-h-[76px] min-h-[56px] rounded-xl bg-raised text-2xl font-medium text-cream active:bg-raised/70"
            >
              {k === 'del' ? '⌫' : k === 'clear' ? 'C' : k}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              setIndex((i) => (i + 1 < ordered.length ? i + 1 : i))
            }
            disabled={index + 1 >= ordered.length}
            className="tap h-14 rounded-xl border border-cream/15 text-base text-muted disabled:opacity-30"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={typed === null || typed <= 0}
            onClick={() => typed !== null && commit(current.id, typed, 'manual')}
            className="tap h-14 rounded-xl bg-heat text-base font-semibold text-ink disabled:opacity-30"
          >
            {index + 1 < ordered.length ? 'Save, next →' : 'Save, finish'}
          </button>
        </div>

        {index + 1 >= ordered.length && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="tap mt-2 h-12 w-full rounded-xl text-sm text-muted"
          >
            Back to the litter
          </button>
        )}
      </div>
    </div>
  );
}

/** Exported for the puppy detail screen's inline "add weight" affordance. */
export function quickDelta(p: PuppyView): string {
  return fmtDelta(p.lastChangeGrams);
}
