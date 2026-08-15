import { CATEGORY_LIST } from '../data/wasteCategories.js';
import { formatKg, formatPercent } from '../utils/format.js';

/**
 * The legend is also the table view: identity comes from the label, and the
 * exact kg and share sit right beside it. That is the required relief for the
 * two category colours that sit below 3:1 contrast on the light surface.
 */
export function CategoryLegend({ rows = [], distributionPct = {}, showValues = true, compact = false }) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {CATEGORY_LIST.map((category) => {
        const row = byKey[category.key] || { kg: 0, count: 0 };
        const share = distributionPct[category.key] ?? 0;

        return (
          <li key={category.category} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: category.color }}
            />
            <span className={`text-ink-secondary ${compact ? 'text-[11px]' : 'text-xs'}`}>
              {category.label}
            </span>

            {showValues ? (
              <span className="ml-auto flex items-baseline gap-2.5 pl-3">
                <span className={`font-semibold tabular-nums text-ink ${compact ? 'text-[11px]' : 'text-xs'}`}>
                  {formatPercent(share)}
                </span>
                <span className="w-16 text-right text-[11px] tabular-nums text-ink-muted">
                  {formatKg(row.kg)}
                </span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
