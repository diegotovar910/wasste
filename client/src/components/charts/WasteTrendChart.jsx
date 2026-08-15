import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_LIST } from '../../data/wasteCategories.js';
import { formatCompact, formatDate, formatKg } from '../../utils/format.js';
import { ChartTooltip, axisProps, gridProps } from './ChartTooltip.jsx';

/**
 * Waste over time, one 2px line per category (section 23).
 * Four converging series are read through the legend plus the crosshair
 * tooltip rather than direct end labels, which would collide.
 */
export function WasteTrendChart({ data = [], height = 260 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="date"
            {...axisProps}
            tickFormatter={(value) => formatDate(value)}
            minTickGap={28}
          />
          <YAxis {...axisProps} tickFormatter={formatCompact} width={48} />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(value) => formatDate(value, { weekday: 'short', month: 'short', day: 'numeric' })}
                valueFormatter={(value) => formatKg(value, 1)}
              />
            }
            cursor={{ stroke: 'var(--axis-line)', strokeWidth: 1 }}
            wrapperStyle={{ outline: 'none' }}
          />

          {CATEGORY_LIST.map((category) => (
            <Line
              key={category.category}
              type="monotone"
              dataKey={category.key}
              name={category.label}
              stroke={category.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
