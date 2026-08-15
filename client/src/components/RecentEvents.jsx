import { categoryMeta } from '../data/wasteCategories.js';
import { formatKg, formatRelativeTime, titleCase } from '../utils/format.js';
import { EmptyState } from './States.jsx';

/** The live classification feed - what the bins have recognised most recently. */
export function RecentEvents({ events = [], showBin = true, limit = 8 }) {
  if (!events.length) {
    return (
      <EmptyState
        title="No classifications yet"
        description="Scan an item on the Waste Scanner page to add the first event."
      />
    );
  }

  return (
    <ul className="divide-y divide-hairline">
      {events.slice(0, limit).map((event) => {
        const meta = categoryMeta(event.category);

        return (
          <li key={event._id || event.id} className="flex items-center gap-3 py-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: meta.color }}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{titleCase(event.item)}</p>
              <p className="truncate text-[11px] text-ink-muted">
                {meta.label}
                {showBin && event.bin ? ` · ${event.bin.name}` : ''}
                {event.needsReview ? ' · needs review' : ''}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[11px] font-semibold tabular-nums text-ink">
                {formatKg(event.estimatedWeightKg, 3)}
              </p>
              <p className="text-[10px] tabular-nums text-ink-muted">
                {formatRelativeTime(event.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
