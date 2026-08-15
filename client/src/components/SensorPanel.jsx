import { SourceTag } from './SourceTag.jsx';
import { formatKg, formatPercent, formatRelativeTime } from '../utils/format.js';

/**
 * The sensor block on the bin detail page (section 11).
 * Everything here is clearly marked as simulated: a real Wasste bin would push
 * these readings from an ultrasonic sensor and a load cell.
 */
export function SensorPanel({ bin, onSimulate, isSimulating }) {
  const sensors = bin.sensors || {};

  const readings = [
    { label: 'Ultrasonic fill sensor', value: formatPercent(bin.currentFillPercentage), hint: 'Distance to waste surface' },
    { label: 'Load cell', value: formatKg(sensors.estimatedWeightKg || 0), hint: 'Weight currently in the bin' },
    { label: 'Temperature probe', value: `${sensors.temperatureC ?? '--'} °C`, hint: 'Organics compartment' },
    { label: 'Last reading', value: formatRelativeTime(sensors.lastReadingAt), hint: 'Reporting interval: 15 min' },
  ];

  const capacityNote = `Fill is everything collected since the bin was last emptied ${formatRelativeTime(
    bin.lastCollectedAt,
  )}.`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Sensors</h2>
        <SourceTag variant="simulated" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        {readings.map((reading) => (
          <div key={reading.label}>
            <dt className="text-[11px] text-ink-muted">{reading.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{reading.value}</dd>
            <p className="mt-0.5 text-[10px] text-ink-muted">{reading.hint}</p>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">{capacityNote}</p>

      {onSimulate ? (
        <button
          type="button"
          onClick={onSimulate}
          disabled={isSimulating}
          className="mt-4 w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-xs font-semibold text-ink transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {isSimulating ? 'Reading sensors…' : 'Simulate a sensor reading'}
        </button>
      ) : null}
    </div>
  );
}
