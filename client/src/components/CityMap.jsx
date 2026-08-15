import { useNavigate } from 'react-router-dom';
import { STATUS_META, statusMeta } from '../data/wasteCategories.js';
import { formatPercent } from '../utils/format.js';

/**
 * A schematic city map (section 21). Bins are placed from their real
 * coordinates but drawn on a stylised plane - no tile provider, no API key and
 * nothing that can block the demo.
 */
export function CityMap({ bins = [], activeBinId }) {
  const navigate = useNavigate();

  const points = bins.filter((bin) => bin.location?.latitude && bin.location?.longitude);

  if (!points.length) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-ink-muted">
        No bin coordinates available.
      </div>
    );
  }

  const latitudes = points.map((bin) => bin.location.latitude);
  const longitudes = points.map((bin) => bin.location.longitude);

  const bounds = {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };

  const spanLat = bounds.maxLat - bounds.minLat || 0.01;
  const spanLng = bounds.maxLng - bounds.minLng || 0.01;

  // 10% padding keeps markers off the edges.
  const project = (bin) => ({
    left: 10 + ((bin.location.longitude - bounds.minLng) / spanLng) * 80,
    top: 10 + ((bounds.maxLat - bin.location.latitude) / spanLat) * 80,
  });

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
        {points.map((bin) => {
          const position = project(bin);
          const meta = statusMeta(bin.status);
          const id = bin.id || bin._id;
          const isActive = activeBinId && String(activeBinId) === String(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(`/bins/${id}`)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
              title={`${bin.name} - ${meta.label}, ${formatPercent(bin.currentFillPercentage)} full`}
            >
              <span
                className={`block rounded-full border-2 transition-transform group-hover:scale-125 ${
                  isActive ? 'scale-125' : ''
                }`}
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: meta.color,
                  borderColor: 'var(--surface-1)',
                }}
              />
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-ink-secondary">
                {bin.code}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-ink-muted">
          Schematic layout from bin coordinates
        </span>
      </div>
    </div>
  );
}
