import { formatPercent } from '../utils/format.js';

/** Fill severity: the bar colour changes as the bin approaches capacity. */
function fillColor(percentage, status) {
  if (status === 'OFFLINE') return 'var(--status-offline)';
  if (percentage >= 90) return 'var(--status-critical)';
  if (percentage >= 70) return 'var(--status-warning)';
  return 'var(--status-good)';
}

/**
 * The meter's track is a translucent step of the fill's own colour, so the
 * state reads across the whole bar rather than only the filled part.
 */
export function FillMeter({ percentage = 0, status, showValue = true, height = 8, label = 'Fill level' }) {
  const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
  const color = fillColor(clamped, status);

  return (
    <div>
      {showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-ink-secondary">{label}</span>
          <span className="text-sm font-semibold tabular-nums text-ink">{formatPercent(clamped)}</span>
        </div>
      ) : null}

      <div
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative w-full overflow-hidden rounded-full"
        style={{ height, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
