import { Link } from 'react-router-dom';
import type { PuppyView } from '../logic/triage';
import {
  SEVERITY_META,
  collarRing,
  collarStyle,
  fmtDelta,
  fmtPct,
  gainTone,
  relativeTime,
} from '../lib/ui';
import { RollingNumber } from './RollingNumber';

export function PuppyCard({ p, now }: { p: PuppyView; now: number }) {
  const meta = p.severity ? SEVERITY_META[p.severity] : null;

  return (
    <Link
      to={`/puppy/${p.id}`}
      style={collarStyle(p.puppy.collar)}
      data-ring={collarRing(p.puppy.collar)}
      className={`spine card block px-3 py-3 transition-colors hover:bg-raised ${
        meta ? meta.border : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-cream">{p.label}</p>
          <p className="num mt-0.5 text-xs text-muted">
            {p.latest ? relativeTime(p.latest.at, now) : 'never weighed'}
            {p.birthWeight !== null && ` · born ${p.birthWeight} g`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {p.latest ? (
            <>
              <RollingNumber
                value={p.latest.grams}
                className="num text-2xl font-semibold leading-none text-cream"
                suffix="g"
              />
              <p className={`num mt-1 text-xs ${gainTone(p.lastChangePct)}`}>
                {fmtDelta(p.lastChangeGrams)}
                {p.lastChangePct !== null && ` · ${fmtPct(p.lastChangePct)}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No weight</p>
          )}
        </div>
      </div>

      {meta && (
        <div className={`mt-2 flex items-start gap-2 rounded-md ${meta.bg} px-2 py-1.5`}>
          <span aria-hidden className={`${meta.text} text-xs leading-5`}>
            {meta.icon}
          </span>
          <p className="text-xs leading-snug text-cream">
            <span className={`font-semibold ${meta.text}`}>{meta.label}:</span>{' '}
            {p.alerts[0].title}
            {p.alerts.length > 1 && (
              <span className="text-muted"> +{p.alerts.length - 1} more</span>
            )}
          </p>
        </div>
      )}
    </Link>
  );
}
