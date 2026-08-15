import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CATEGORY_LIST } from '../../data/wasteCategories.js';
import { formatKg, formatNumber } from '../../utils/format.js';
import { ChartTooltip } from './ChartTooltip.jsx';

/**
 * Waste distribution for one bin or the whole city (section 13).
 * Segments are always drawn in the fixed category order and separated by a 2px
 * surface-coloured gap rather than an outline.
 */
export function WasteDonut({ rows = [], height = 200, centerLabel = 'Collected' }) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  const data = CATEGORY_LIST.map((category) => ({
    name: category.label,
    key: category.key,
    value: byKey[category.key]?.kg ?? 0,
    color: category.color,
  }));

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (total <= 0) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-muted" style={{ height }}>
        No waste recorded yet.
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={1}
            stroke="var(--surface-1)"
            strokeWidth={2}
            isAnimationActive
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatKg(value, 1)} />}
            wrapperStyle={{ outline: 'none' }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight text-ink">{formatNumber(total)}</span>
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">kg {centerLabel}</span>
      </div>
    </div>
  );
}
