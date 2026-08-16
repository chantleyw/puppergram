import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LitterView } from '../logic/triage';
import { collarHex } from '../lib/ui';
import { T } from '../logic/triage';

interface TooltipEntry {
  name?: string;
  value?: number | [number, number] | null;
  color?: string;
  dataKey?: string | number;
}

/** Written by hand so the median band never appears as a data row. */
function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(
    (e) => e.dataKey !== 'band' && typeof e.value === 'number'
  );
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-cream/12 bg-raised px-3 py-2 shadow-lg">
      <p className="num mb-1 text-xs text-cream">Day {label}</p>
      {rows.map((e) => (
        <p key={String(e.dataKey)} className="num flex items-baseline gap-2 text-xs">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: e.color }}
          />
          <span className="text-muted">{e.name}</span>
          <span className="ml-auto text-cream">{Math.round(e.value as number)} g</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Each puppy's line is drawn in its literal collar colour, which is why this
 * chart has no legend: the reader already identifies puppies by exactly this
 * system, from the yarn round their necks.
 */
export function GrowthChart({
  view,
  focusPuppyId,
  height = 260,
}: {
  view: LitterView;
  focusPuppyId?: number;
  height?: number;
}) {
  const focused = focusPuppyId
    ? view.puppies.find((p) => p.id === focusPuppyId)
    : undefined;

  const rows = view.days.map((d) => {
    const row: Record<string, number | null | [number, number]> = { day: d.day };
    for (const p of view.puppies) {
      row[`p${p.id}`] = p.cells[d.day]?.point?.grams ?? null;
    }
    row.median = d.median;
    // The band runs from the litter median down to the divergence floor,
    // 25% below it — the region where a puppy is falling behind its siblings.
    row.band =
      d.median === null
        ? null
        : [Math.round(d.median * (1 - T.divergenceFraction)), d.median];
    return row;
  });

  const hasMedian = view.days.some((d) => d.median !== null);
  const series = focused ? [focused] : view.puppies;

  if (view.totalWeights === 0) {
    return (
      <div className="card flex h-[220px] items-center justify-center px-6">
        <p className="text-center text-sm text-muted">
          The growth curve appears as soon as the first weights are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="card px-1 pb-2 pt-3">
      <div className="mb-1 flex items-baseline justify-between px-3">
        <h2 className="display text-base text-cream">
          {focused ? `${focused.label} vs. litter` : 'Growth'}
        </h2>
        <p className="text-xs text-muted">
          {focused && hasMedian ? 'Shaded band: median down to −25%' : 'Grams by day'}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 6, right: 14, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="rgba(237,227,216,0.07)" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: number) => `D${d}`}
            stroke="#9C8B7E"
            tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(237,227,216,0.12)' }}
          />
          <YAxis
            stroke="#9C8B7E"
            tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={['dataMin - 30', 'dataMax + 30']}
            tickFormatter={(v: number) => `${Math.round(v)}`}
          />

          {focused && hasMedian && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="rgba(237,227,216,0.06)"
              isAnimationActive={false}
              activeDot={false}
              connectNulls
            />
          )}

          {hasMedian && (
            <Line
              type="monotone"
              dataKey="median"
              stroke="#9C8B7E"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
              name="Litter median"
            />
          )}

          {series.map((p) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={`p${p.id}`}
              name={p.label}
              stroke={collarHex(p.puppy.collar)}
              strokeWidth={focused ? 2.75 : 2}
              dot={{ r: focused ? 3 : 0, strokeWidth: 0, fill: collarHex(p.puppy.collar) }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}

          <Tooltip content={<GrowthTooltip />} cursor={{ stroke: 'rgba(237,227,216,0.2)' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
