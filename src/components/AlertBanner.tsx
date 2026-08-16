import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LitterView, Severity } from '../logic/triage';
import { SEVERITY_META } from '../lib/ui';

const ORDER: Severity[] = ['critical', 'warning', 'info'];

export function AlertBanner({ view }: { view: LitterView }) {
  const worst = view.puppies.find((p) => p.id === view.worstPuppyId);
  const topSeverity: Severity | null =
    ORDER.find((s) => view.counts[s] > 0) ?? null;

  // A single pulse when the severity changes — not a loop, not an ambience.
  const previous = useRef<Severity | null>(null);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (previous.current !== null && previous.current !== topSeverity && topSeverity) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 950);
      return () => clearTimeout(t);
    }
    previous.current = topSeverity;
  }, [topSeverity]);

  if (!topSeverity || !worst) {
    return (
      <div
        className="card border-good/30 bg-good/5 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-good">
            ✓
          </span>
          <p className="text-sm text-cream">
            <span className="font-semibold">All clear.</span>{' '}
            <span className="text-muted">
              {view.puppies.length} puppies, every one gaining normally.
            </span>
          </p>
        </div>
      </div>
    );
  }

  const meta = SEVERITY_META[topSeverity];
  const alert = worst.alerts[0];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`card ${meta.border} ${meta.bg} ${pulse ? 'animate-pulse-once' : ''} px-4 py-3`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-sm font-semibold ${meta.text}`}>
          <span aria-hidden>{meta.icon}</span> {meta.label}
        </span>
        {ORDER.filter((s) => view.counts[s] > 0).map((s) => (
          <span key={s} className="num text-xs text-muted">
            {view.counts[s]} {SEVERITY_META[s].label.toLowerCase()}
            {view.counts[s] === 1 ? '' : 's'}
          </span>
        ))}
      </div>

      <p className="mt-1.5 text-[15px] leading-snug text-cream">{alert.detail}</p>
      <p className="mt-1 text-sm leading-snug text-muted">{alert.action}</p>

      <Link
        to={`/puppy/${worst.id}`}
        className="tap mt-2 inline-flex items-center text-sm font-medium text-heat underline underline-offset-4"
      >
        Open {worst.label} →
      </Link>
    </div>
  );
}
