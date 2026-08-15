import { CATEGORY_LIST } from '../data/wasteCategories.js';
import { formatPercent } from '../utils/format.js';

/**
 * A compact stacked bar of the four sub-bins. Segments keep the fixed category
 * order and are separated by a 2px surface gap instead of an outline.
 */
export function DistributionBar({ distributionPct = {}, height = 8, showLabels = false }) {
  const segments = CATEGORY_LIST.map((category) => ({
    ...category,
    value: distributionPct[category.key] ?? 0,
  })).filter((segment) => segment.value > 0);

  if (!segments.length) {
    return <div className="w-full rounded-full bg-inset" style={{ height }} aria-hidden="true" />;
  }

  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full" style={{ height }}>
        {segments.map((segment, index) => (
          <div key={segment.key} className="flex h-full" style={{ width: `${segment.value}%` }}>
            <div
              className="h-full flex-1"
              style={{ backgroundColor: segment.color }}
              title={`${segment.label}: ${formatPercent(segment.value)}`}
            />
            {index < segments.length - 1 ? (
              <div className="h-full w-0.5 shrink-0 bg-surface" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>

      {showLabels ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {CATEGORY_LIST.map((category) => (
            <li key={category.key} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: category.color }}
              />
              {category.shortLabel}
              <span className="font-semibold tabular-nums text-ink">
                {formatPercent(distributionPct[category.key] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
