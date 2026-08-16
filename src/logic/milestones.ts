import { MILESTONES, type MilestoneDef } from '../db/constants';
import type { CareEvent } from '../db/schema';

export type MilestoneState = 'pending' | 'due' | 'done';

export interface MilestoneView extends MilestoneDef {
  state: MilestoneState;
  /** The care event that satisfied this milestone, if any. */
  completedBy?: CareEvent;
  windowLabel: string;
}

/**
 * Deworming and vaccination are satisfied by a matching CareEvent of the right
 * kind whose date falls on or after the milestone's window opening. Multiple
 * dewormings are distinguished by consuming events in date order, so the first
 * recorded deworming closes day 14, the second closes day 28, and so on.
 */
export function buildMilestones(
  ageDays: number,
  care: CareEvent[],
  /** Milestone ids the data itself already satisfies, e.g. birth weights. */
  autoDone: ReadonlySet<string> = new Set()
): MilestoneView[] {
  const dewormings = care
    .filter((c) => c.kind === 'deworming')
    .sort((a, b) => a.at - b.at);
  const vaccinations = care
    .filter((c) => c.kind === 'vaccination')
    .sort((a, b) => a.at - b.at);
  const notes = care.filter((c) => c.kind === 'note' || c.kind === 'vet');

  let dewormIdx = 0;
  let vaccIdx = 0;

  return MILESTONES.map((m) => {
    const end = m.dayEnd ?? m.day;
    let completedBy: CareEvent | undefined;

    if (m.kind === 'deworming') {
      completedBy = dewormings[dewormIdx];
      if (completedBy) dewormIdx += 1;
    } else if (m.kind === 'vaccination') {
      completedBy = vaccinations[vaccIdx];
      if (completedBy) vaccIdx += 1;
    } else {
      // Observational and husbandry milestones are closed by a "mark seen"
      // note tagged with the milestone id.
      completedBy = notes.find((c) => c.note?.startsWith(`[${m.id}]`));
    }

    const state: MilestoneState =
      completedBy || autoDone.has(m.id)
        ? 'done'
        : ageDays >= m.day
          ? 'due'
          : 'pending';

    const windowLabel =
      m.dayEnd && m.dayEnd !== m.day ? `Day ${m.day}–${m.dayEnd}` : `Day ${m.day}`;

    return { ...m, state, completedBy, windowLabel, dayEnd: end };
  });
}

/** The label written into a CareEvent note when the user taps "Mark seen". */
export function markSeenNote(milestoneId: string, title: string) {
  return `[${milestoneId}] ${title} — marked seen`;
}
