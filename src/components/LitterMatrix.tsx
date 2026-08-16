import { Link } from 'react-router-dom';
import type { LitterView } from '../logic/triage';
import {
  SEVERITY_META,
  collarRing,
  collarStyle,
  fmtDelta,
  gainCellClass,
  gainTone,
} from '../lib/ui';

/**
 * Tablet and desktop rendering: puppies as rows, days as columns. A new column
 * appears the moment the first weight of a new day lands, because the columns
 * are derived from the data rather than scheduled.
 */
export function LitterMatrix({ view }: { view: LitterView }) {
  const days = view.days;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-cream/8 px-4 py-3">
        <h2 className="display text-base text-cream">Litter matrix</h2>
        <p className="text-xs text-muted">Cell tint shows the day's gain</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Daily weights in grams for each puppy, with the change from the
            previous day.
          </caption>
          <thead>
            <tr className="border-b border-cream/8">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted"
              >
                Puppy
              </th>
              {days.map((d) => (
                <th
                  key={d.day}
                  scope="col"
                  className="num px-3 py-2 text-right text-xs font-medium text-muted"
                >
                  D{d.day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {view.puppies.map((p) => {
              const meta = p.severity ? SEVERITY_META[p.severity] : null;
              return (
                <tr key={p.id} className="border-b border-cream/5 last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal"
                  >
                    <Link
                      to={`/puppy/${p.id}`}
                      style={collarStyle(p.puppy.collar)}
                      data-ring={collarRing(p.puppy.collar)}
                      className="spine flex items-center gap-2"
                    >
                      <span className="truncate text-[15px] text-cream">{p.label}</span>
                      {meta && (
                        <span
                          className={`${meta.text} shrink-0 text-[10px]`}
                          title={`${meta.label}: ${p.alerts[0].title}`}
                        >
                          <span aria-hidden>{meta.icon}</span>
                          <span className="sr-only">
                            {meta.label}: {p.alerts[0].title}
                          </span>
                        </span>
                      )}
                    </Link>
                  </th>

                  {days.map((d) => {
                    const cell = p.cells[d.day];
                    if (!cell?.point) {
                      return (
                        <td
                          key={d.day}
                          className="num px-3 py-2 text-right text-muted/40"
                        >
                          ·
                        </td>
                      );
                    }
                    return (
                      <td
                        key={d.day}
                        className={`num px-3 py-2 text-right ${gainCellClass(cell.gainPct)}`}
                      >
                        <span className="block text-cream">{cell.point.grams}</span>
                        <span className={`block text-[11px] ${gainTone(cell.gainPct)}`}>
                          {fmtDelta(cell.gainGrams)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr className="bg-raised/60">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-raised px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted"
              >
                Median
              </th>
              {days.map((d) => (
                <td key={d.day} className="num px-3 py-2 text-right text-xs text-muted">
                  {d.median === null ? '·' : Math.round(d.median)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
