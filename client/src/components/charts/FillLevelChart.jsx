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
import { formatPercent } from '../../utils/format.js';
import { ChartTooltip, axisProps } from './ChartTooltip.jsx';

const fillColor = (bin) => {
  if (bin.status === 'OFFLINE') return 'var(--status-offline)';
  if (bin.fillPercentage >= 90) return 'var(--status-critical)';
  if (bin.fillPercentage >= 70) return 'var(--status-warning)';
  return 'var(--status-good)';
};

/** Bin fill levels, fullest first - effectively the collection queue. */
export function FillLevelChart({ bins = [], height = 300 }) {
  const data = bins.map((bin) => ({
    name: bin.code || bin.name,
    fullName: bin.name,
    fillPercentage: bin.fillPercentage,
    status: bin.status,
    color: fillColor(bin),
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axisProps} tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="name" {...axisProps} width={56} />
          <Tooltip
            cursor={{ fill: 'var(--surface-3)' }}
            wrapperStyle={{ outline: 'none' }}
            content={
              <ChartTooltip
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                valueFormatter={(value) => formatPercent(value)}
              />
            }
          />

          <Bar dataKey="fillPercentage" name="Fill level" maxBarSize={18} radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
            <LabelList
              dataKey="fillPercentage"
              position="right"
              offset={8}
              formatter={(value) => `${Math.round(value)}%`}
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
