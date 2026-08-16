import { FEEDING_DISCLAIMER } from '../db/constants';
import { formatTempTarget } from '../logic/feeding';
import type { LitterView } from '../logic/triage';
import { collarRing, collarStyle } from '../lib/ui';

/**
 * Temperature and feeding. Both are derived from the litter's age and the
 * latest weights, so they move on their own as the litter grows — there is
 * nothing here to keep up to date by hand.
 */
export function CareCards({ view }: { view: LitterView }) {
  const weighed = view.puppies.filter((p) => p.feeding);
  const total = weighed.reduce((sum, p) => sum + (p.latest?.grams ?? 0), 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* ---------------- Temperature ---------------- */}
      <section className="card px-4 py-3">
        <h2 className="display text-base text-cream">Box temperature</h2>
        <p className="num mt-2 text-3xl font-semibold text-heat">
          {formatTempTarget(view.tempTarget)}
        </p>
        <p className="mt-1 text-sm text-muted">
          Target for {view.tempTarget.weekLabel.toLowerCase()}, ambient in the
          whelping box.
        </p>
        <p className="mt-2 text-xs leading-snug text-muted">
          Measure at floor level, not at the lamp. A neonate cannot regulate its
          own temperature and will not digest milk if it is cold.
        </p>
      </section>

      {/* ---------------- Feeding ---------------- */}
      <section className="card px-4 py-3">
        <h2 className="display text-base text-cream">Supplemental feeding</h2>

        {weighed.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Record a weight and the feed volumes appear here.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              {weighed[0].feeding!.intervalLabel}, {weighed[0].feeding!.feedsPerDay}{' '}
              feeds a day
            </p>

            <ul className="mt-2 divide-y divide-cream/6">
              {weighed.map((p) => (
                <li
                  key={p.id}
                  style={collarStyle(p.puppy.collar)}
                  data-ring={collarRing(p.puppy.collar)}
                  className="spine flex items-baseline justify-between py-1.5"
                >
                  <span className="truncate text-sm text-cream">{p.label}</span>
                  <span className="num shrink-0 text-sm text-cream">
                    {p.feeding!.perFeedMlMin}–{p.feeding!.perFeedMlMax}
                    <span className="ml-1 text-xs text-muted">ml/feed</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Show the arithmetic rather than asking for trust. */}
            <details className="mt-2">
              <summary className="tap cursor-pointer text-xs text-heat">
                Show the arithmetic
              </summary>
              <p className="num mt-1.5 text-[11px] leading-relaxed text-muted">
                {weighed[0].label}: {weighed[0].feeding!.workings}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Litter total {Math.round(total)} g. Guideline is 15–20 ml of
                formula per 100 g of body weight per day.
              </p>
            </details>
          </>
        )}

        <p className="mt-2 border-t border-cream/8 pt-2 text-xs text-muted">
          {FEEDING_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}
