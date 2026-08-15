import { formatKg, formatPercent } from '../../utils/format.js';

/**
 * Landfill diversion (section 23): the one number that says whether Wasste is
 * working. Two segments, separated by a 2px surface gap.
 */
export function DiversionMeter({ divertedKg = 0, landfillKg = 0 }) {
  const total = divertedKg + landfillKg;
  const rate = total > 0 ? Math.round((divertedKg / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-4xl font-semibold tracking-tight text-ink">{formatPercent(rate)}</span>
          <p className="mt-0.5 text-xs text-ink-muted">of collected waste kept out of landfill</p>
        </div>
      </div>

      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-inset" role="img"
        aria-label={`${rate}% diverted, ${100 - rate}% landfill`}>
        <div
          className="h-full rounded-l-full transition-[width] duration-500"
          style={{ width: `${rate}%`, backgroundColor: 'var(--cat-organics)' }}
        />
        <div className="h-full w-0.5 shrink-0 bg-surface" aria-hidden="true" />
        <div
          className="h-full flex-1 rounded-r-full"
          style={{ backgroundColor: 'var(--cat-landfill)' }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--cat-organics)' }} />
          <dt className="text-ink-secondary">Diverted</dt>
          <dd className="ml-auto font-semibold tabular-nums text-ink">{formatKg(divertedKg)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--cat-landfill)' }} />
          <dt className="text-ink-secondary">Landfill</dt>
          <dd className="ml-auto font-semibold tabular-nums text-ink">{formatKg(landfillKg)}</dd>
        </div>
      </dl>
    </div>
  );
}
