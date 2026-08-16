import { db } from '../db/schema';
import type { LitterView } from '../logic/triage';
import { markSeenNote, type MilestoneState, type MilestoneView } from '../logic/milestones';
import { fmtDate } from '../lib/ui';

const STATE_META: Record<
  MilestoneState,
  { label: string; icon: string; dot: string; text: string }
> = {
  done: { label: 'Done', icon: '✓', dot: 'bg-good', text: 'text-good' },
  due: { label: 'Due', icon: '●', dot: 'bg-heat', text: 'text-heat' },
  pending: { label: 'Later', icon: '○', dot: 'bg-cream/20', text: 'text-muted' },
};

export function Timeline({ view }: { view: LitterView }) {
  async function markSeen(m: MilestoneView) {
    await db.care.add({
      litterId: view.litterId,
      kind: 'note',
      at: Date.now(),
      note: markSeenNote(m.id, m.title),
    });
  }

  async function record(m: MilestoneView) {
    await db.care.add({
      litterId: view.litterId,
      kind: m.kind === 'vaccination' ? 'vaccination' : 'deworming',
      at: Date.now(),
      note: m.title,
    });
  }

  return (
    <section className="card px-4 py-3">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="display text-base text-cream">Timeline</h2>
        <p className="num text-xs text-muted">{view.ageLabel}</p>
      </div>

      <ol className="relative space-y-0">
        {view.milestones.map((m, i) => {
          const meta = STATE_META[m.state];
          const actionable = m.state === 'due';
          return (
            <li key={m.id} className="relative flex gap-3 pb-3 last:pb-0">
              {/* connector */}
              {i < view.milestones.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-4 h-full w-px bg-cream/10"
                />
              )}
              <span
                aria-hidden
                className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${meta.dot}`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p
                    className={`text-sm font-medium ${
                      m.state === 'pending' ? 'text-muted' : 'text-cream'
                    }`}
                  >
                    {m.title}
                  </p>
                  <span className="num text-[11px] text-muted">{m.windowLabel}</span>
                  <span className={`text-[11px] ${meta.text}`}>
                    <span aria-hidden>{meta.icon}</span> {meta.label}
                  </span>
                </div>

                <p className="mt-0.5 text-xs leading-snug text-muted">{m.detail}</p>

                {m.completedBy && (
                  <p className="num mt-0.5 text-[11px] text-good">
                    Recorded {fmtDate(m.completedBy.at)}
                  </p>
                )}

                {actionable && (
                  <button
                    type="button"
                    onClick={() =>
                      m.kind === 'deworming' || m.kind === 'vaccination'
                        ? record(m)
                        : markSeen(m)
                    }
                    className="tap mt-1.5 rounded-md border border-heat/40 px-3 py-1 text-xs font-medium text-heat hover:bg-heat/10"
                  >
                    {m.kind === 'deworming' || m.kind === 'vaccination'
                      ? 'Record as done'
                      : 'Mark seen'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
