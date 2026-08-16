import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import { COLLAR_ORDER, DAY, HOUR } from '../db/constants';
import { loadLitterView, useLitterView } from '../hooks/useLitterView';
import { backlogReadback, weighReadback } from '../logic/readback';
import { parseSpeech, type ParseResult } from '../lib/parseSpeech';
import { speak } from '../lib/voice';
import { collarHex, fmtDate, relativeTime, toLocalInput } from '../lib/ui';
import { VoiceButton } from './VoiceButton';
import { dayIndex, lastPointBeforeDay, type PuppyView } from '../logic/triage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

export function WeighFlow({ litterId }: { litterId: number }) {
  const view = useLitterView(litterId);
  const navigate = useNavigate();

  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  /* null means "now". Anything else is a backlogged entry. */
  const [targetAt, setTargetAt] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
  const backlog = targetAt !== null;
  const effectiveAt = targetAt ?? Date.now();
  const targetDay = view ? dayIndex(effectiveAt, view.litter.whelpedAt) : 0;

  const commit = useCallback(
    async (puppyId: number, grams: number, source: 'manual' | 'voice') => {
      const at = targetAt ?? Date.now();
      await db.weights.add({ puppyId, at, grams, source });

      const fresh = await loadLitterView(litterId);
      const p = fresh?.puppies.find((x) => x.id === puppyId);
      if (p) {
        // Re-derive from the same pure function that drives the screen, so a
        // live readback and the visible alert can never disagree. A backlogged
        // entry gets a plain confirmation instead — see backlogReadback.
        const line = targetAt
          ? backlogReadback(
              p.label,
              grams,
              dayIndex(at, fresh!.litter.whelpedAt)
            )
          : weighReadback(p);
        setSaved(line);
        void speak(line);
      }

      setEntry('');
      setPending(null);
      setMessage(null);
      setIndex((i) => (i + 1 < ordered.length ? i + 1 : i));
    },
    [litterId, ordered.length, targetAt]
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

  /* Physical keyboard support, for the desktop workflow. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending || pickerOpen) return;
      if (/^\d$/.test(e.key)) setEntry((s) => (s.length < 5 ? s + e.key : s));
      else if (e.key === 'Backspace') setEntry((s) => s.slice(0, -1));
      else if (e.key === 'Enter' && entry && current) {
        void commit(current.id, parseInt(entry, 10), 'manual');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, current, pending, pickerOpen, commit]);

  if (!view) return <p className="p-6 text-sm text-muted">Loading…</p>;

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

  /* When backlogging, the useful reference is the last weight from a day
     *before* the target day — not the most recent overall, and not the target
     day's own existing reading, which would make the expected range describe
     the day after the one being entered. */
  const priorPoint = backlog
    ? lastPointBeforeDay(current.points, targetDay)
    : current.latest;

  const expected = priorPoint
    ? {
        min: Math.round(priorPoint.grams * 1.05),
        max: Math.round(priorPoint.grams * 1.1),
      }
    : null;

  const alreadyOnDay = current.points.some(
    (pt) => dayIndex(pt.at, view.litter.whelpedAt) === targetDay
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink">
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
              boxShadow: 'inset 0 0 0 1px rgba(248,237,228,0.35)',
            }}
          />
          <h1 className="display text-3xl leading-none text-cream">{current.label}</h1>
        </div>

        <p className="num mt-1.5 text-xs text-muted">
          {priorPoint
            ? backlog
              ? `Previous ${priorPoint.grams} g`
              : `Last ${priorPoint.grams} g, ${relativeTime(priorPoint.at, view.now)}`
            : 'No previous weight'}
          {expected && ` · expect ${expected.min}–${expected.max} g`}
        </p>
      </header>

      <DayTarget
        whelpedAt={view.litter.whelpedAt}
        ageDays={view.ageDays}
        puppyCount={ordered.length}
        countForDay={(d) =>
          view.puppies.reduce(
            (n, p) =>
              n +
              (p.points.some((pt) => dayIndex(pt.at, view.litter.whelpedAt) === d)
                ? 1
                : 0),
            0
          )
        }
        targetAt={targetAt}
        targetDay={targetDay}
        open={pickerOpen}
        setOpen={setPickerOpen}
        onChange={setTargetAt}
      />

      {alreadyOnDay && (
        <p className="mx-4 mb-2 text-xs text-caution" role="status">
          {current.label} already has a weight on day {targetDay}. Saving adds a
          second reading for that day.
        </p>
      )}

      <div className="flex min-h-[84px] shrink-0 items-center justify-center px-4">
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

      {pending && (
        <div className="mx-4 mb-3 rounded-xl border border-heat/40 bg-heat/10 px-3 py-2.5">
          <p className="text-xs text-muted">Heard “{pending.transcript}”</p>
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
                  commit((pendingPuppy ?? current).id, pending.grams!, 'voice')
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
              className="num tap h-[13vh] max-h-[72px] min-h-[54px] rounded-xl bg-raised text-2xl font-medium text-cream active:bg-raised/70"
            >
              {k === 'del' ? '⌫' : k === 'clear' ? 'C' : k}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1 < ordered.length ? i + 1 : i))}
            disabled={index + 1 >= ordered.length}
            className="tap h-14 rounded-xl border border-cream/15 text-base text-muted disabled:opacity-30"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={typed === null || typed <= 0}
            onClick={() => typed !== null && commit(current.id, typed, 'manual')}
            className={`tap h-14 rounded-xl text-base font-semibold disabled:opacity-30 ${
              backlog ? 'bg-iris text-ink' : 'gradient-action'
            }`}
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

/* ------------------------------------------------------------------ */

/**
 * Chooses which day the weights are being recorded against.
 *
 * Defaults to now. The day chips exist because the common real case is not
 * "pick an arbitrary date" — it is "I weighed them every day but only got
 * round to typing in day 0 and day 9", and the user needs to see at a glance
 * which days are missing.
 */
function DayTarget({
  whelpedAt,
  ageDays,
  puppyCount,
  countForDay,
  targetAt,
  targetDay,
  open,
  setOpen,
  onChange,
}: {
  whelpedAt: number;
  ageDays: number;
  puppyCount: number;
  countForDay: (day: number) => number;
  targetAt: number | null;
  targetDay: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onChange: (v: number | null) => void;
}) {
  const backlog = targetAt !== null;
  const days = Array.from({ length: ageDays + 1 }, (_, d) => d);

  /* Midday of the day's bucket, so the entry lands unambiguously inside it,
     clamped so it can never be in the future. */
  function timestampForDay(d: number) {
    return Math.min(whelpedAt + d * DAY + 12 * HOUR, Date.now());
  }

  return (
    <div className="mx-4 mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={
          backlog
            ? `Recording for day ${targetDay}, ${fmtDate(targetAt!)}. Change the day.`
            : `Recording for now, day ${targetDay}. Change the day.`
        }
        className={`tap flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
          backlog
            ? 'border-iris/50 bg-iris/15'
            : 'border-cream/12 bg-surface/60'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wide text-muted">
            Recording for
          </span>
          <span
            className={`num block truncate text-sm ${backlog ? 'text-iris' : 'text-cream'}`}
          >
            {backlog
              ? `Day ${targetDay} · ${fmtDate(targetAt!)}`
              : `Now · day ${targetDay}`}
          </span>
        </span>
        <span aria-hidden className="ml-2 shrink-0 text-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-cream/12 bg-surface p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`tap rounded-lg px-3 py-1.5 text-xs font-medium ${
                !backlog ? 'bg-heat text-ink' : 'border border-cream/20 text-cream'
              }`}
            >
              Now
            </button>

            {days.map((d) => {
              const n = countForDay(d);
              const full = n >= puppyCount;
              const selected = backlog && d === targetDay;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onChange(timestampForDay(d));
                    setOpen(false);
                  }}
                  title={`Day ${d}: ${n} of ${puppyCount} weighed`}
                  className={`num tap rounded-lg px-2.5 py-1.5 text-xs ${
                    selected
                      ? 'bg-iris text-ink'
                      : full
                        ? 'border border-mint/40 text-mint'
                        : n > 0
                          ? 'border border-caution/40 text-caution'
                          : 'border border-cream/15 text-muted'
                  }`}
                >
                  D{d}
                  <span className="ml-1 opacity-70">
                    {full ? '✓' : n > 0 ? `${n}` : '·'}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] text-muted">
              Or pick an exact date and time
            </span>
            <input
              type="datetime-local"
              className="num w-full rounded-lg border border-cream/15 bg-ink px-3 py-2 text-sm text-cream"
              value={toLocalInput(targetAt ?? Date.now())}
              min={toLocalInput(whelpedAt)}
              max={toLocalInput(Date.now())}
              onChange={(e) => {
                const ms = new Date(e.target.value).getTime();
                if (Number.isNaN(ms)) return;
                // Never before the whelp, never in the future.
                onChange(Math.min(Math.max(ms, whelpedAt), Date.now()));
              }}
            />
          </label>

          <p className="mt-2 text-[11px] leading-snug text-muted">
            <span className="text-mint">✓</span> all weighed ·{' '}
            <span className="text-caution">n</span> partly done ·{' '}
            <span className="text-muted">·</span> nothing yet. Backlogged entries
            are saved exactly like live ones and feed the same alerts.
          </p>
        </div>
      )}
    </div>
  );
}
