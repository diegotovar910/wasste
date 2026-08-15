import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { RouteMap } from '../components/RouteMap.jsx';
import { RouteBriefingCard } from '../components/RouteBriefingCard.jsx';
import { RoutePlannerControls } from '../components/RoutePlannerControls.jsx';
import { SourceTag } from '../components/SourceTag.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EmptyState, ErrorState, LoadingPage } from '../components/States.jsx';
import { formatDuration, formatKg, formatKm, formatNumber, formatPercent } from '../utils/format.js';

const DEFAULT_PARAMS = {
  mode: 'COLLECTION',
  objective: 'DISTANCE',
  fillThreshold: 70,
  includeOffline: true,
  alwaysCollectFull: true,
  maxStops: 0,
  maxShiftMinutes: 480,
  payloadKg: 0,
  departureTime: '07:00',
};

const REASON_LABEL = {
  FULL: 'Full',
  NEEDS_ATTENTION: 'Filling up',
  NO_SENSOR_DATA: 'Sensor offline',
};

/**
 * The route planner.
 *
 * Every control maps to a validated API parameter and the plan is solved
 * deterministically, so the whole page re-solves in milliseconds. The AI
 * briefing is a separate, explicit action.
 */
export default function RouteOptimization() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [analysis, setAnalysis] = useState(null);

  const { data, error, isLoading, refetch } = useApi(
    (signal) => api.optimizeRoute(params, signal),
    [JSON.stringify(params)],
  );

  const analyse = useAction(useCallback(() => api.analyseRoute(params), [params]));

  // A briefing describes one specific route, so drop it when the plan changes.
  useEffect(() => setAnalysis(null), [JSON.stringify(params)]);

  const runBriefing = async () => {
    const response = await analyse.run();
    if (response) setAnalysis(response.analysis);
  };

  /**
   * Adopts the settings the agent suggested. Only keys the planner actually
   * accepts are taken, so a stray field from the model cannot leak into the
   * request.
   */
  const applyRecommendedSettings = (suggested = {}) => {
    const next = { ...params };
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      if (suggested[key] !== undefined) next[key] = suggested[key];
    }
    setParams(next);
  };

  // Keep the previous plan on screen while a new one is solved.
  if (isLoading && !data) return <LoadingPage />;
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState error={error} onRetry={refetch} title="Could not build a collection route" />
        <button
          type="button"
          onClick={() => setParams(DEFAULT_PARAMS)}
          className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink"
        >
          Reset the planner
        </button>
      </div>
    );
  }

  const { plan } = data;
  const {
    stops,
    notSelected,
    droppedByConstraint,
    optimised,
    baseline,
    savings,
    monthlyProjection,
    solverGain,
    assumptions,
    vehicle,
  } = plan;

  const isMaintenance = plan.params.mode === 'MAINTENANCE';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Route planner</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          Build a round from live bin telemetry instead of a fixed weekly loop. Set the parameters on
          the left; the route, its cost and its savings are re-solved on every change.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <RoutePlannerControls
            params={params}
            options={plan.options}
            onChange={setParams}
            onReset={() => setParams(DEFAULT_PARAMS)}
            isRefreshing={isLoading}
          />
        </div>

        <div className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={`${plan.params.modeLabel} · ${vehicle.label}`}
              value={`${optimised.stopCount} of ${baseline.stopCount}`}
              hero
              note={
                isMaintenance
                  ? `${plan.technicianStops} sensor fault${plan.technicianStops === 1 ? '' : 's'} to inspect`
                  : `Roughly ${formatKg(optimised.collectedKg)} to collect`
              }
              className="sm:col-span-2"
            />
            <MetricCard
              label="Route distance"
              value={formatNumber(optimised.distanceKm, 1)}
              unit="km"
              note={`${formatDuration(optimised.totalMinutes)} · back at ${plan.returnToDepotClock}`}
            />
            <MetricCard
              label="Running cost"
              value={`$${formatNumber(optimised.fuelCost, 2)}`}
              variant="estimated"
              note={`${formatNumber(optimised.fuelLitres, 1)} L of fuel`}
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Time saved per round"
              value={formatDuration(savings.minutes)}
              variant="estimated"
              note={`${formatPercent(savings.percentTime)} less than visiting every bin`}
            />
            <MetricCard
              label="CO₂ saved per round"
              value={formatNumber(savings.co2Kg, 1)}
              unit="kg"
              variant="estimated"
              note={`${formatPercent(savings.percentCo2)} less than visiting every bin`}
            />
          </section>

          {droppedByConstraint.length ? (
            <Card className="border-l-2 p-5" style={{ borderLeftColor: 'var(--status-warning)' }}>
              <CardHeader
                title={`${droppedByConstraint.length} qualifying bin${droppedByConstraint.length > 1 ? 's' : ''} did not fit`}
                subtitle="These met your selection rules but were cut to satisfy a limit"
              />
              <ul className="mt-3 divide-y divide-hairline">
                {droppedByConstraint.map((bin) => (
                  <li key={bin.binId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/bins/${bin.binId}`} className="truncate text-xs font-medium text-ink hover:underline">
                        {bin.name}
                      </Link>
                      <p className="text-[11px] text-ink-muted">{bin.deferralLabel}</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-ink">
                      {formatPercent(bin.fillPercentage)}
                    </span>
                    {bin.daysUntilFull != null ? (
                      <span className="w-24 text-right text-[11px] text-ink-muted">
                        full in ~{bin.daysUntilFull} d
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-5">
            <CardHeader
              title="Route map"
              subtitle={`${plan.depot.name} → ${optimised.stopCount} stops → depot`}
            />
            <div className="mt-4">
              <RouteMap
                depot={plan.depot}
                stops={stops}
                skipped={[...notSelected, ...droppedByConstraint]}
              />
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="Stop sequence" subtitle={`Departing ${plan.params.departureTime}`} />

            {stops.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-ink-muted">
                      <th scope="col" className="pb-2 font-medium">#</th>
                      <th scope="col" className="pb-2 font-medium">Wasste bin</th>
                      <th scope="col" className="pb-2 text-right font-medium">Fill</th>
                      <th scope="col" className="pb-2 text-right font-medium">Load</th>
                      <th scope="col" className="pb-2 text-right font-medium">Leg</th>
                      <th scope="col" className="pb-2 text-right font-medium">Arrive</th>
                      <th scope="col" className="pb-2 text-right font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {stops.map((stop) => (
                      <tr key={stop.binId}>
                        <td className="py-2.5 font-semibold tabular-nums text-ink">{stop.order}</td>
                        <th scope="row" className="py-2.5 font-medium text-ink">
                          <Link to={`/bins/${stop.binId}`} className="hover:underline">
                            {stop.name}
                          </Link>
                          <span className="block text-[11px] font-normal text-ink-muted">{stop.address}</span>
                        </th>
                        <td className="py-2.5 text-right tabular-nums text-ink">
                          {stop.needsTechnician ? (
                            <span title="Last known reading before the sensor went offline">
                              {formatPercent(stop.fillPercentage)}*
                            </span>
                          ) : (
                            formatPercent(stop.fillPercentage)
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                          {formatKg(stop.loadKg)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                          {formatKm(stop.legDistanceKm)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                          {stop.etaClock}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="text-[11px] text-ink-secondary" title={stop.reasonLabel}>
                            {REASON_LABEL[stop.reason] || stop.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {plan.technicianStops > 0 ? (
                  <p className="mt-3 text-[11px] text-ink-muted">
                    * Last reading before the sensor went offline. The real level may differ.
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No round needed"
                description={
                  isMaintenance
                    ? 'Every sensor in the network is reporting normally.'
                    : `No bin qualifies at a ${plan.params.fillThreshold}% threshold with the current settings.`
                }
              />
            )}
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader title="Versus visiting every bin" subtitle={`Same ${vehicle.label.toLowerCase()}, all ${baseline.stopCount} bins`} />

              <table className="mt-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    <th scope="col" className="pb-2 font-medium">Measure</th>
                    <th scope="col" className="pb-2 text-right font-medium">Fixed</th>
                    <th scope="col" className="pb-2 text-right font-medium">Planned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[
                    ['Stops', baseline.stopCount, optimised.stopCount],
                    ['Distance', formatKm(baseline.distanceKm), formatKm(optimised.distanceKm)],
                    ['Time', formatDuration(baseline.totalMinutes), formatDuration(optimised.totalMinutes)],
                    ['Fuel', `${formatNumber(baseline.fuelLitres, 1)} L`, `${formatNumber(optimised.fuelLitres, 1)} L`],
                    ['CO₂', formatKg(baseline.co2Kg, 1), formatKg(optimised.co2Kg, 1)],
                    ['Cost', `$${formatNumber(baseline.fuelCost, 2)}`, `$${formatNumber(optimised.fuelCost, 2)}`],
                  ].map(([label, fixed, planned]) => (
                    <tr key={label}>
                      <th scope="row" className="py-2 font-normal text-ink-secondary">{label}</th>
                      <td className="py-2 text-right tabular-nums text-ink-muted">{fixed}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-ink">{planned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
                {solverGain.distanceKm > 0
                  ? `Re-sequencing the stops saves a further ${formatKm(solverGain.distanceKm)} beyond simply visiting fewer bins.`
                  : 'For this set of stops the fixed round-sheet order was already efficient, so the saving comes entirely from visiting fewer bins.'}
              </p>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <CardHeader
                    title="Projected monthly saving"
                    subtitle={`At ${monthlyProjection.roundsPerMonth} rounds a month`}
                  />
                  <SourceTag variant="estimated" />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4">
                  {[
                    ['Crew time', `${monthlyProjection.hoursSaved} h`],
                    ['CO₂', `${formatNumber(monthlyProjection.co2KgSaved)} kg`],
                    ['Fuel', `${formatNumber(monthlyProjection.fuelLitresSaved)} L`],
                    ['Cost', `$${formatNumber(monthlyProjection.fuelCostSaved)}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-ink-muted">{label}</dt>
                      <dd className="mt-0.5 text-xl font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card className="flex-1 p-5">
                <CardHeader title="Not selected" subtitle="Did not qualify under these settings" />

                {notSelected.length ? (
                  <ul className="mt-3 divide-y divide-hairline">
                    {notSelected.slice(0, 6).map((bin) => (
                      <li key={bin.binId} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <Link to={`/bins/${bin.binId}`} className="truncate text-xs font-medium text-ink hover:underline">
                            {bin.name}
                          </Link>
                          <p className="text-[11px] text-ink-muted">
                            {bin.deferralLabel}
                            {bin.daysUntilFull != null ? ` · full in ~${bin.daysUntilFull} days` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-ink">
                          {formatPercent(bin.fillPercentage)}
                        </span>
                        <StatusBadge status={bin.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs text-ink-muted">Every bin in the network is on this round.</p>
                )}
              </Card>
            </div>
          </section>

          <RouteBriefingCard
            analysis={analysis}
            isRunning={analyse.isRunning}
            error={analyse.error}
            onRun={runBriefing}
            onApplySettings={applyRecommendedSettings}
          />

          <Card className="p-5">
            <CardHeader
              title="How these figures are produced"
              subtitle={`${vehicle.label} · stated assumptions, not measurements`}
            />

            <dl className="mt-4 grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Speed in traffic', `${vehicle.averageSpeedKmh} km/h`],
                ['Time per stop', `${vehicle.serviceMinutesPerStop} min`],
                ['Road detour factor', `× ${assumptions.roadDistanceFactor}`],
                ['Fuel while driving', `${vehicle.fuelLitresPerKm} L/km`],
                ['Fuel while stopped', `${vehicle.idleFuelLitresPerMinute} L/min`],
                ['CO₂ per litre', `${assumptions.co2KgPerLitreDiesel} kg`],
                ['Fuel price', `$${assumptions.fuelCostPerLitre}/L`],
                ['Vehicle payload', vehicle.effectivePayloadKg > 0 ? `${vehicle.effectivePayloadKg} kg` : 'not limited'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-ink-secondary">{label}</dt>
                  <dd className="font-medium tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-4 space-y-1.5 border-t border-hairline pt-4">
              {assumptions.notes.map((note) => (
                <li key={note} className="flex gap-2 text-[11px] leading-relaxed text-ink-muted">
                  <span aria-hidden="true">·</span>
                  {note}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
