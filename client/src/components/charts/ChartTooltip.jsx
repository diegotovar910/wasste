/** One tooltip shared by every chart, so hover always looks and reads the same. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;

  const heading = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div className="pointer-events-none min-w-40 rounded-lg border border-hairline bg-surface p-2.5 shadow-lg">
      {heading ? (
        <p className="mb-1.5 text-[11px] font-semibold tracking-tight text-ink">{heading}</p>
      ) : null}

      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={`${entry.dataKey || entry.name}-${index}`} className="flex items-center gap-2 text-[11px]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.payload?.fill }}
            />
            <span className="text-ink-secondary">{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
              {valueFormatter ? valueFormatter(entry.value, entry) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared axis presentation: recessive, hairline, never dashed. */
export const axisProps = {
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--axis-line)' },
};

export const gridProps = {
  stroke: 'var(--grid-line)',
  strokeWidth: 1,
  vertical: false,
};
