import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_LIST, categoryByKey } from '../../data/wasteCategories.js';
import { formatCompact, formatKg, formatNumber } from '../../utils/format.js';
import { ChartTooltip, axisProps, gridProps } from './ChartTooltip.jsx';

/**
 * Waste by category (section 23). One measure, so no legend box is needed -
 * the axis labels already name each bar and the value rides the cap.
 */
export function CategoryBarChart({ rows = [], height = 260 }) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  const data = CATEGORY_LIST.map((category) => ({
    name: category.shortLabel,
    key: category.key,
    kg: byKey[category.key]?.kg ?? 0,
    count: byKey[category.key]?.count ?? 0,
    color: category.color,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatCompact} width={48} />
          <Tooltip
            cursor={{ fill: 'var(--surface-3)' }}
            wrapperStyle={{ outline: 'none' }}
            content={
              <ChartTooltip
                valueFormatter={(value, entry) =>
                  `${formatKg(value, 1)} · ${formatNumber(entry.payload.count)} items`
                }
              />
            }
          />

          <Bar dataKey="kg" name="Collected" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
            <LabelList
              dataKey="kg"
              position="top"
              offset={8}
              formatter={(value) => formatNumber(value)}
              fill="var(--text-secondary)"
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const categoryColorForKey = (key) => categoryByKey(key).color;
