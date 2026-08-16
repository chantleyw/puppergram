import { EXPECTED_GAIN_LABEL, RULES } from '../logic/triage';
import { SEVERITY_META } from '../lib/ui';

/**
 * The rules are hard-coded and shown in full. A breeder is being asked to act
 * on these at 3am; they are entitled to know exactly what triggered the alarm.
 */
export function RulesTable({ open = false }: { open?: boolean }) {
  return (
    <details className="card px-4 py-3" open={open}>
      <summary className="tap cursor-pointer text-sm font-medium text-cream">
        How alerts work
      </summary>

      <p className="mt-2 text-sm text-muted">
        Normal expectation is {EXPECTED_GAIN_LABEL}, and roughly double the birth
        weight by day 7–10. Every rule below is fixed and applied to the weights
        you have entered — nothing is inferred or predicted.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream/10 text-left">
              <th className="py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-muted">
                Rule
              </th>
              <th className="py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-muted">
                Condition
              </th>
              <th className="py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                Severity
              </th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => {
              const meta = SEVERITY_META[r.severity];
              return (
                <tr key={r.id} className="border-b border-cream/5 last:border-0">
                  <td className="py-2 pr-3 text-cream">{r.name}</td>
                  <td className="py-2 pr-3 text-muted">{r.condition}</td>
                  <td className={`py-2 whitespace-nowrap ${meta.text}`}>
                    <span aria-hidden>{meta.icon}</span> {meta.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        A puppy shows only its highest severity; critical outranks warning,
        which outranks info. Puppergram is a breeder's record-keeping tool, not
        veterinary advice — if something looks wrong, call your vet.
      </p>
    </details>
  );
}
