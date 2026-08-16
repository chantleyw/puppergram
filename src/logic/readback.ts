import type { LitterView, PuppyView } from './triage';

/**
 * Spoken copy. Kept separate from the components so the wording is testable
 * and consistent, and so the escalation is driven by the same triage output
 * that colours the screen.
 *
 * Tone: a competent vet nurse at 3am. Calm, active, no exclamation marks.
 */

const collarOf = (p: PuppyView) =>
  p.puppy.collar.charAt(0).toUpperCase() + p.puppy.collar.slice(1);

/** "Blue, 245 grams, up 18. Good." */
export function weighReadback(p: PuppyView): string {
  if (!p.latest) return '';
  const name = collarOf(p);
  const grams = `${p.latest.grams} grams`;
  const change = p.lastChangeGrams;

  const worst = p.alerts[0];

  if (worst?.severity === 'critical') {
    if (worst.ruleId === 'below-birth-weight') {
      return `${name}, ${grams}. ${name} is below its birth weight. Call your vet today.`;
    }
    return `${name}, ${grams}. ${name} has lost more than ten percent from its peak. Call your vet today.`;
  }

  if (worst?.severity === 'warning') {
    if (worst.ruleId === 'weight-loss') {
      return `${name} has lost weight since the last weigh-in. Check warmth and nursing.`;
    }
    if (worst.ruleId === 'failure-to-gain') {
      return `${name}, ${grams}. No gain in twenty four hours. Check warmth and nursing.`;
    }
    if (worst.ruleId === 'litter-divergence') {
      return `${name}, ${grams}. ${name} is falling behind the litter. Give it first access at the next feed.`;
    }
    return `${name}, ${grams}. ${worst.title}. Check warmth and nursing.`;
  }

  if (change === null) return `${name}, ${grams}. First weight recorded.`;
  if (change > 0) return `${name}, ${grams}, up ${change}. Good.`;
  if (change === 0) return `${name}, ${grams}. No change.`;
  return `${name}, ${grams}, down ${Math.abs(change)}.`;
}

/** One button, whole-litter status, hands free. */
export function dailyBriefing(view: LitterView): string {
  const parts: string[] = [];
  const n = view.puppies.length;
  parts.push(
    `Day ${view.ageDays}. ${n} ${n === 1 ? 'puppy' : 'puppies'} in ${view.litter.damName}'s litter.`
  );

  const flagged = view.puppies.filter((p) => p.severity);
  const clear = n - flagged.length;

  if (flagged.length === 0) {
    parts.push('All puppies gaining normally. Nothing needs attention.');
  } else {
    if (clear > 0) {
      parts.push(`${clear} gaining normally.`);
    }
    const critical = flagged.filter((p) => p.severity === 'critical');
    const warning = flagged.filter((p) => p.severity === 'warning');
    const info = flagged.filter((p) => p.severity === 'info');

    for (const p of critical) {
      parts.push(`${collarOf(p)} needs a vet today. ${p.alerts[0].detail}`);
    }
    for (const p of warning) {
      parts.push(`${collarOf(p)}. ${p.alerts[0].detail}`);
    }
    if (info.length) {
      parts.push(
        `${info.map(collarOf).join(' and ')} ${info.length === 1 ? 'has' : 'have'} not been weighed recently.`
      );
    }
  }

  const due = view.milestones.filter((m) => m.state === 'due');
  if (due.length) {
    parts.push(`Due now: ${due.map((m) => m.title.toLowerCase()).join(', ')}.`);
  }

  parts.push(
    `Box temperature should be ${
      view.tempTarget.minC === view.tempTarget.maxC
        ? `${view.tempTarget.minC} degrees`
        : `${view.tempTarget.minC} to ${view.tempTarget.maxC} degrees`
    } Celsius.`
  );

  return parts.join(' ');
}
