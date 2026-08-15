import { Link } from 'react-router-dom';
import { Card } from './Card.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { FillMeter } from './FillMeter.jsx';
import { DistributionBar } from './DistributionBar.jsx';
import { formatKg, formatRelativeTime } from '../utils/format.js';

/** One Wasste bin, summarised for the city overview grid (section 12). */
export function BinCard({ bin }) {
  const distribution = bin.wasteDistribution || {};

  return (
    <Card as="article" className="flex flex-col gap-4 p-4 transition-colors hover:border-ink-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/bins/${bin.id || bin._id}`}
            className="text-sm font-semibold tracking-tight text-ink hover:underline"
          >
            {bin.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{bin.location?.address}</p>
        </div>
        <StatusBadge status={bin.status} size="sm" />
      </div>

      <FillMeter percentage={bin.currentFillPercentage} status={bin.status} />

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-ink-muted">In bin now</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatKg(bin.sensors?.estimatedWeightKg || 0)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Collected to date</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">{formatKg(bin.totalWasteKg || 0)}</dd>
        </div>
      </dl>

      <div>
        <p className="mb-1.5 text-[11px] text-ink-muted">Waste distribution</p>
        <DistributionBar distributionPct={distribution} />
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-hairline pt-3 text-[11px] text-ink-muted">
        <span>Updated {formatRelativeTime(bin.lastUpdated)}</span>
        <Link to={`/bins/${bin.id || bin._id}`} className="font-semibold text-ink hover:underline">
          Details →
        </Link>
      </div>
    </Card>
  );
}
