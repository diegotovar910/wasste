import { Card } from './Card.jsx';
import { SourceTag } from './SourceTag.jsx';

/**
 * Stat tile: label, value, optional unit and footnote.
 * `hero` renders the one lead figure a view is allowed to have.
 */
export function MetricCard({
  label,
  value,
  unit,
  note,
  variant = 'measured',
  hero = false,
  accent,
  className = '',
}) {
  return (
    <Card className={`flex flex-col justify-between gap-3 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-secondary">{label}</span>
        <SourceTag variant={variant} />
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-semibold tracking-tight text-ink ${hero ? 'text-5xl' : 'text-3xl'}`}
            style={accent ? { color: accent } : undefined}
          >
            {value}
          </span>
          {unit ? <span className="text-sm font-medium text-ink-muted">{unit}</span> : null}
        </div>
        {note ? <p className="mt-1 text-xs leading-relaxed text-ink-muted">{note}</p> : null}
      </div>
    </Card>
  );
}
