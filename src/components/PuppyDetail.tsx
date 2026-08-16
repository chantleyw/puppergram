import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useLitterView } from '../hooks/useLitterView';
import { GrowthChart } from './GrowthChart';
import {
  SEVERITY_META,
  collarHex,
  fmtDelta,
  fmtDateTime,
  fmtPct,
  gainTone,
} from '../lib/ui';

export function PuppyDetail() {
  const puppyId = Number(useParams().puppyId);
  const puppy = useLiveQuery(() => db.puppies.get(puppyId), [puppyId]);
  const view = useLitterView(puppy?.litterId);

  if (puppy === undefined || view === undefined) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }
  if (!puppy) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">That puppy is not on this device.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-heat underline">
          Back to the litter
        </Link>
      </div>
    );
  }

  const p = view.puppies.find((x) => x.id === puppyId);
  if (!p) return null;

  const accent = collarHex(puppy.collar);
  const care = view.care.filter((c) => c.puppyId === puppyId || c.puppyId === undefined);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="tap -ml-2 px-2 text-sm text-muted hover:text-cream">
          ← Litter
        </Link>
        <Link
          to={`/passport/${puppyId}`}
          className="tap rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream"
        >
          Passport
        </Link>
      </div>

      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-12 w-2 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: 'inset 0 0 0 1px rgba(237,227,216,0.3)' }}
        />
        <div>
          <h1 className="display text-2xl text-cream">{p.label}</h1>
          <p className="num text-sm text-muted">
            {puppy.sex === 'F' ? 'Female' : 'Male'} · {view.litter.breed} ·{' '}
            {view.ageLabel}
          </p>
        </div>
      </header>

      {/* Headline numbers */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current" value={p.latest ? `${p.latest.grams} g` : '—'} />
        <Stat
          label="Change"
          value={fmtDelta(p.lastChangeGrams)}
          tone={gainTone(p.lastChangePct)}
          sub={fmtPct(p.lastChangePct)}
        />
        <Stat label="Birth weight" value={p.birthWeight ? `${p.birthWeight} g` : '—'} />
        <Stat
          label="Of birth weight"
          value={p.multipleOfBirth ? `${p.multipleOfBirth.toFixed(2)}×` : '—'}
        />
      </div>

      {/* Alerts */}
      {p.alerts.length > 0 && (
        <section className="mb-4 space-y-2">
          {p.alerts.map((a) => {
            const meta = SEVERITY_META[a.severity];
            return (
              <div
                key={a.ruleId}
                className={`card ${meta.border} ${meta.bg} px-4 py-3`}
                role="alert"
              >
                <p className={`text-sm font-semibold ${meta.text}`}>
                  <span aria-hidden>{meta.icon}</span> {meta.label} · {a.title}
                </p>
                <p className="mt-1 text-sm text-cream">{a.detail}</p>
                <p className="mt-1 text-sm text-muted">{a.action}</p>
              </div>
            );
          })}
        </section>
      )}

      <div className="mb-4">
        <GrowthChart view={view} focusPuppyId={puppyId} height={240} />
      </div>

      {/* Weight history */}
      <section className="card mb-4 px-4 py-3">
        <h2 className="display text-base text-cream">Weight history</h2>
        {p.points.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No weights recorded yet.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream/10 text-left">
                <th className="py-1 text-xs font-medium text-muted">When</th>
                <th className="py-1 text-xs font-medium text-muted">Day</th>
                <th className="py-1 text-right text-xs font-medium text-muted">Grams</th>
                <th className="py-1 text-right text-xs font-medium text-muted">Change</th>
                <th className="py-1 text-right text-xs font-medium text-muted">Source</th>
              </tr>
            </thead>
            <tbody>
              {[...p.points].reverse().map((pt, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? pt.grams - prev.grams : null;
                const pctChange = prev ? (pt.grams - prev.grams) / prev.grams : null;
                return (
                  <tr key={pt.id ?? pt.at} className="border-b border-cream/5 last:border-0">
                    <td className="num py-1.5 text-cream">{fmtDateTime(pt.at)}</td>
                    <td className="num py-1.5 text-muted">D{pt.day}</td>
                    <td className="num py-1.5 text-right text-cream">{pt.grams}</td>
                    <td className={`num py-1.5 text-right ${gainTone(pctChange)}`}>
                      {fmtDelta(delta)}
                    </td>
                    <td className="py-1.5 text-right text-xs text-muted">
                      {pt.source}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Care events */}
      <section className="card px-4 py-3">
        <h2 className="display text-base text-cream">Care events</h2>
        {care.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing recorded. Dewormings and vet visits logged on the timeline
            appear here.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {care.map((c) => (
              <li key={c.id} className="border-b border-cream/5 pb-1.5 last:border-0">
                <p className="num text-xs text-muted">{fmtDateTime(c.at)}</p>
                <p className="text-sm text-cream">
                  <span className="capitalize">{c.kind}</span>
                  {c.note ? ` — ${c.note}` : ''}
                  {c.puppyId === undefined && (
                    <span className="ml-1 text-xs text-muted">(whole litter)</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'text-cream',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-0.5 text-xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className={`num text-xs ${tone}`}>{sub}</p>}
    </div>
  );
}
