import type { CSSProperties } from 'react';
import { COLLARS } from '../db/constants';
import type { CollarColour } from '../db/schema';
import type { Severity } from '../logic/triage';

export function collarStyle(collar: CollarColour): CSSProperties {
  return { ['--spine-color' as string]: COLLARS[collar].hex };
}

export function collarHex(collar: CollarColour): string {
  return COLLARS[collar].hex;
}

export function collarRing(collar: CollarColour): 'true' | 'false' {
  return COLLARS[collar].ring ? 'true' : 'false';
}

/** Alert state is never colour alone: colour + label + icon, always. */
export const SEVERITY_META: Record<
  Severity,
  { label: string; icon: string; text: string; bg: string; border: string }
> = {
  critical: {
    label: 'Critical',
    icon: '▲',
    text: 'text-alarm',
    bg: 'bg-alarm/10',
    border: 'border-alarm/40',
  },
  warning: {
    label: 'Warning',
    icon: '●',
    text: 'text-caution',
    bg: 'bg-caution/10',
    border: 'border-caution/40',
  },
  info: {
    label: 'Info',
    icon: '■',
    text: 'text-muted',
    bg: 'bg-cream/5',
    border: 'border-cream/15',
  },
};

export function gainTone(gainPct: number | null): string {
  if (gainPct === null) return 'text-muted';
  if (gainPct < 0) return 'text-alarm';
  if (gainPct < 0.02) return 'text-caution';
  return 'text-good';
}

/** Cell tint for the matrix, keyed off daily gain. */
export function gainCellClass(gainPct: number | null): string {
  if (gainPct === null) return '';
  if (gainPct < 0) return 'bg-alarm/15';
  if (gainPct < 0.02) return 'bg-caution/15';
  if (gainPct >= 0.05) return 'bg-good/12';
  return 'bg-good/5';
}

export const fmtGrams = (g: number) => `${Math.round(g)}`;

export function fmtDelta(g: number | null): string {
  if (g === null) return '—';
  if (g === 0) return '±0';
  return g > 0 ? `+${g}` : `${g}`;
}

export function fmtPct(p: number | null): string {
  if (p === null) return '';
  const v = Math.round(p * 1000) / 10;
  return `${v > 0 ? '+' : ''}${v}%`;
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(ms: number): string {
  return `${fmtDate(ms)}, ${fmtTime(ms)}`;
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = now - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Local datetime string for an <input type="datetime-local"> default. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
