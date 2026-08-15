import { Card, CardHeader } from './Card.jsx';

/** A labelled row that keeps every control in the panel aligned the same way. */
function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-secondary">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--text-primary)]"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="text-xs font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

/** A number input where 0 means "no limit". */
function LimitInput({ id, value, onChange, min, max, unit, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink"
      />
      <span className="text-xs text-ink-muted">{unit}</span>
      {value === 0 ? <span className="text-[11px] text-ink-muted">· no limit</span> : null}
    </div>
  );
}

const selectClass =
  'w-full rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm text-ink';

/**
 * The planner's control panel (sections 21 and 25 applied to operations).
 *
 * Every control maps one-to-one onto a validated API parameter. The route is
 * solved deterministically in milliseconds, so changes apply immediately - no
 * "calculate" button and no AI call.
 */
export function RoutePlannerControls({ params, options, onChange, onReset, isRefreshing }) {
  const set = (patch) => onChange({ ...params, ...patch });

  const modes = options?.modes || [];
  const objectives = options?.objectives || [];
  const activeMode = modes.find((mode) => mode.id === params.mode);
  const isMaintenance = params.mode === 'MAINTENANCE';

  return (
    <Card className="p-5">
      <CardHeader
        title="Plan the round"
        subtitle="Changes apply instantly"
        action={
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:text-ink"
          >
            Reset
          </button>
        }
      />

      <div className="mt-5 space-y-5">
        <Field label="What is this round for?" hint={activeMode?.description}>
          <div className="grid gap-1.5">
            {modes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => set({ mode: mode.id })}
                aria-pressed={params.mode === mode.id}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  params.mode === mode.id
                    ? 'border-ink-muted bg-inset text-ink'
                    : 'border-hairline text-ink-secondary hover:text-ink'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="border-t border-hairline pt-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Which bins
          </p>

          <div className="space-y-4">
            <Field
              label={`Fill threshold — ${params.fillThreshold}%`}
              htmlFor="fillThreshold"
              hint={
                isMaintenance
                  ? 'Not used on a technician run, which targets sensor faults instead.'
                  : 'Bins at or above this level earn a stop.'
              }
            >
              <input
                id="fillThreshold"
                type="range"
                min={0}
                max={100}
                step={5}
                value={params.fillThreshold}
                disabled={isMaintenance}
                onChange={(event) => set({ fillThreshold: Number(event.target.value) })}
                className="w-full accent-[var(--text-primary)] disabled:opacity-40"
              />
            </Field>

            <Toggle
              id="includeOffline"
              checked={params.includeOffline}
              onChange={(includeOffline) => set({ includeOffline })}
              label="Visit bins with offline sensors"
              hint="Their real level is unknown, so a crew has to go and look."
            />

            <Toggle
              id="alwaysCollectFull"
              checked={params.alwaysCollectFull}
              onChange={(alwaysCollectFull) => set({ alwaysCollectFull })}
              label="Always collect bins at 90% or more"
              hint="Overrides the threshold to prevent overflow."
            />
          </div>
        </div>

        <div className="border-t border-hairline pt-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Limits
          </p>

          <div className="space-y-4">
            <Field label="Maximum stops" htmlFor="maxStops">
              <LimitInput
                id="maxStops"
                value={params.maxStops}
                onChange={(maxStops) => set({ maxStops })}
                min={0}
                max={50}
                unit="stops"
              />
            </Field>

            <Field label="Shift length" htmlFor="maxShiftMinutes">
              <LimitInput
                id="maxShiftMinutes"
                value={params.maxShiftMinutes}
                onChange={(maxShiftMinutes) => set({ maxShiftMinutes })}
                min={0}
                max={1440}
                unit="minutes"
              />
            </Field>

            <Field
              label="Vehicle payload"
              htmlFor="payloadKg"
              hint="Leave at 0 to use the vehicle's own capacity."
            >
              <LimitInput
                id="payloadKg"
                value={params.payloadKg}
                onChange={(payloadKg) => set({ payloadKg })}
                min={0}
                max={20000}
                unit="kg"
              />
            </Field>

            <Field
              label="When a limit binds, drop"
              htmlFor="objective"
              hint={objectives.find((objective) => objective.id === params.objective)?.description}
            >
              <select
                id="objective"
                value={params.objective}
                onChange={(event) => set({ objective: event.target.value })}
                className={selectClass}
              >
                {objectives.map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="border-t border-hairline pt-5">
          <Field label="Departure time" htmlFor="departureTime" hint="Used for the arrival clock on each stop.">
            <input
              id="departureTime"
              type="time"
              value={params.departureTime}
              onChange={(event) => set({ departureTime: event.target.value })}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink"
            />
          </Field>
        </div>

        {isRefreshing ? (
          <p className="text-[11px] text-ink-muted" role="status">
            Re-solving the route…
          </p>
        ) : null}
      </div>
    </Card>
  );
}
