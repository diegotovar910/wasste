import { useNavigate } from 'react-router-dom';
import { formatKm, formatPercent } from '../utils/format.js';

const stopColor = (stop) => {
  if (stop.status === 'OFFLINE') return 'var(--status-offline)';
  if (stop.fillPercentage >= 90) return 'var(--status-critical)';
  if (stop.fillPercentage >= 70) return 'var(--status-warning)';
  return 'var(--status-good)';
};

/**
 * Schematic map of one collection round.
 *
 * Bins sit at their real coordinates projected onto a stylised plane; the line
 * is the actual solved sequence. The SVG stretches with the container
 * (preserveAspectRatio="none") so its endpoints line up exactly with the HTML
 * markers drawn on top - leg angles are therefore indicative, not surveyed.
 */
export function RouteMap({ depot, stops = [], skipped = [] }) {
  const navigate = useNavigate();

  const points = [depot, ...stops, ...skipped].filter(
    (point) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
  );

  if (points.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-ink-muted">
        Not enough coordinates to draw a route.
      </div>
    );
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const bounds = {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };

  const spanLat = bounds.maxLat - bounds.minLat || 0.01;
  const spanLng = bounds.maxLng - bounds.minLng || 0.01;

  const project = (point) => ({
    x: 10 + ((point.longitude - bounds.minLng) / spanLng) * 80,
    y: 10 + ((bounds.maxLat - point.latitude) / spanLat) * 80,
  });

  const depotPoint = project(depot);
  const legs = [depotPoint, ...stops.map(project), depotPoint];
  const polyline = legs.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div>
      <div
        className="relative aspect-[16/11] w-full overflow-hidden rounded-lg border border-hairline bg-inset"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '11.11% 12.5%',
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {stops.length ? (
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--text-secondary)"
              strokeLinejoin="round"
              strokeLinecap="round"
              /* non-scaling-stroke keeps the line 2px even though the SVG is
                 stretched to match the container's aspect ratio. */
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 2 }}
            />
          ) : null}
        </svg>

        {/* Bins not on today's round, drawn recessive so the route reads first. */}
        {skipped.map((bin) => {
          const position = project(bin);
          return (
            <button
              key={bin.binId || bin.code}
              type="button"
              onClick={() => bin.binId && navigate(`/bins/${bin.binId}`)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              title={`${bin.name} - ${formatPercent(bin.fillPercentage)} full, skipped today`}
            >
              <span
                className="block rounded-full border-2 bg-surface"
                style={{ width: 12, height: 12, borderColor: 'var(--text-muted)' }}
              />
            </button>
          );
        })}

        {/* The depot: where the round starts and ends. */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${depotPoint.x}%`, top: `${depotPoint.y}%` }}
          title={`${depot.name} (depot)`}
        >
          <span
            className="block rotate-45 border-2"
            style={{ width: 14, height: 14, backgroundColor: 'var(--text-primary)', borderColor: 'var(--surface-1)' }}
          />
        </div>

        {stops.map((stop) => {
          const position = project(stop);
          return (
            <button
              key={stop.binId}
              type="button"
              onClick={() => navigate(`/bins/${stop.binId}`)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              title={`Stop ${stop.order}: ${stop.name} - ${formatPercent(stop.fillPercentage)} full`}
            >
              <span
                className="flex items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform group-hover:scale-110"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: stopColor(stop),
                  borderColor: 'var(--surface-1)',
                  color: '#ffffff',
                }}
              >
                {stop.order}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block rotate-45" style={{ width: 9, height: 9, backgroundColor: 'var(--text-primary)' }} />
          Depot
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--status-critical)' }} />
          Full
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--status-warning)' }} />
          Needs collection
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--status-offline)' }} />
          Sensor offline
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 bg-surface" style={{ borderColor: 'var(--text-muted)' }} />
          Skipped today
        </span>
        <span className="ml-auto text-ink-muted">
          Schematic layout · legs are straight-line distance × 1.35
        </span>
      </div>
    </div>
  );
}
