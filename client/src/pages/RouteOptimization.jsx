import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { RouteMap } from '../components/RouteMap.jsx';
import { RouteBriefingCard } from '../components/RouteBriefingCard.jsx';
import { SourceTag } from '../components/SourceTag.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EmptyState, ErrorState, LoadingPage } from '../components/States.jsx';
import { formatDuration, formatKg, formatKm, formatNumber, formatPercent } from '../utils/format.js';

const THRESHOLDS = [60, 70, 80, 90];

const REASON_LABEL = {
  FULL: 'Full',
  NEEDS_ATTENTION: 'Filling up',
  NO_SENSOR_DATA: 'Sensor offline',
};

/**
 * Collection route optimisation.
 *
 * The route is solved in the backend; this page presents it and lets the agent
 * explain it. Every projected saving is tagged as an estimate.
 */
export default function RouteOptimization() {
  const [fillThreshold, setFillThreshold] = useState(70);
  const [analysis, setAnalysis] = useState(null);

  const { data, error, isLoading, refetch } = useApi(
    (signal) => api.optimizeRoute(fillThreshold, signal),
    [fillThreshold],
  );

  const analyse = useAction(useCallback(() => api.analyseRoute(fillThreshold), [fillThreshold]));

  // The briefing describes one specific route, so drop it when the route changes.
  useEffect(() => setAnalysis(null), [fillThreshold]);

  const runBriefing = async () => {
    const response = await analyse.run();
    if (response) setAnalysis(response.analysis);
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not build a collection route" />;

  const { plan } = data;
  const { stops, skipped, optimised, baseline, savings, monthlyProjection, solverGain, assumptions } = plan;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Collection route</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Today&apos;s round, built from live fill levels instead of a fixed weekly loop. Bins below
            the threshold are left for a later round.
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2" role="group" aria-label="Fill threshold">
            <span className="text-xs text-ink-muted">Collect at</span>
            <div className="flex rounded-lg border border-hairline p-0.5">
              {THRESHOLDS.map((threshold) => (
                <button
                  key={threshold}
                  type="button"
                  onClick={() => setFillThreshold(threshold)}
                  aria-pressed={fillThreshold === threshold}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    fillThreshold === threshold ? 'bg-inset text-ink' : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  {threshold}%
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 max-w-xs text-right text-[11px] leading-relaxed text-ink-muted">
            Bins at 90% or above, and bins with no sensor reading, are always collected whatever the
            threshold.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Stops on this round"
          value={`${optimised.stopCount} of ${baseline.stopCount}`}
          hero
          note={`Roughly ${formatKg(optimised.collectedKg)} to collect`}
          className="sm:col-span-2 lg:col-span-2"
        />
        <MetricCard
          label="Route distance"
          value={formatNumber(optimised.distanceKm, 1)}
          unit="km"
          note={`${formatDuration(optimised.totalMinutes)} including ${optimised.serviceMinutes} min servicing`}
        />
        <MetricCard
          label="Time saved per round"
          value={formatDuration(savings.minutes)}
          variant="estimated"
          note={`${formatPercent(savings.percentTime)} less than the fixed round`}
        />
        <MetricCard
          label="CO₂ saved per round"
          value={formatNumber(savings.co2Kg, 1)}
          unit="kg"
          variant="estimated"
          note={`${formatPercent(savings.percentCo2)} less than the fixed round`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Route map"
            subtitle={`${plan.depot.name} → ${optimised.stopCount} stops → depot`}
          />
          <div className="mt-4">
            <RouteMap depot={plan.depot} stops={stops} skipped={skipped} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <CardHeader
                title="Versus a fixed round"
                subtitle="What sensor-driven collection changes"
              />
            </div>

            <table className="mt-4 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-muted">
                  <th scope="col" className="pb-2 font-medium">Measure</th>
                  <th scope="col" className="pb-2 text-right font-medium">Fixed</th>
                  <th scope="col" className="pb-2 text-right font-medium">Optimised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                <tr>
                  <th scope="row" className="py-2 font-normal text-ink-secondary">Stops</th>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{baseline.stopCount}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{optimised.stopCount}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 font-normal text-ink-secondary">Distance</th>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{formatKm(baseline.distanceKm)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{formatKm(optimised.distanceKm)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 font-normal text-ink-secondary">Time</th>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{formatDuration(baseline.totalMinutes)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{formatDuration(optimised.totalMinutes)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 font-normal text-ink-secondary">Diesel</th>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{formatNumber(baseline.fuelLitres, 1)} L</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{formatNumber(optimised.fuelLitres, 1)} L</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 font-normal text-ink-secondary">CO₂</th>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{formatKg(baseline.co2Kg, 1)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">{formatKg(optimised.co2Kg, 1)}</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              {solverGain.distanceKm > 0
                ? `Re-sequencing the stops saves a further ${formatKm(solverGain.distanceKm)} beyond simply visiting fewer bins.`
                : 'For this set of stops the fixed round sheet order was already efficient, so the saving comes entirely from skipping bins that are not full.'}
            </p>
          </Card>

          <Card className="flex-1 p-5">
            <div className="flex items-start justify-between gap-3">
              <CardHeader title="Projected monthly saving" subtitle={`At ${monthlyProjection.roundsPerMonth} rounds a month`} />
              <SourceTag variant="estimated" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-ink-muted">Crew time</dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink">{monthlyProjection.hoursSaved} h</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">CO₂</dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink">{formatNumber(monthlyProjection.co2KgSaved)} kg</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">Diesel</dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink">{formatNumber(monthlyProjection.fuelLitresSaved)} L</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">Distance</dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink">{formatNumber(monthlyProjection.distanceKmSaved)} km</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Stop sequence" subtitle="Depart the depot and work down this list" />

          {stops.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    <th scope="col" className="pb-2 font-medium">#</th>
                    <th scope="col" className="pb-2 font-medium">Wasste bin</th>
                    <th scope="col" className="pb-2 text-right font-medium">Fill</th>
                    <th scope="col" className="pb-2 text-right font-medium">Load</th>
                    <th scope="col" className="pb-2 text-right font-medium">Leg</th>
                    <th scope="col" className="pb-2 text-right font-medium">ETA</th>
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
                        {formatPercent(stop.fillPercentage)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                        {formatKg(stop.loadKg)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                        {formatKm(stop.legDistanceKm)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-secondary">
                        +{formatDuration(stop.etaMinutes)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className="text-[11px] text-ink-secondary"
                          title={stop.reasonLabel}
                        >
                          {REASON_LABEL[stop.reason] || stop.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No collection needed today"
              description={`Every bin is below ${fillThreshold}%. Lower the threshold to plan an earlier round.`}
            />
          )}
        </Card>

        <Card className="p-5">
          <CardHeader title="Skipped today" subtitle="Left for a later round, with time to spare" />

          {skipped.length ? (
            <ul className="mt-3 divide-y divide-hairline">
              {skipped.map((bin) => (
                <li key={bin.binId} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/bins/${bin.binId}`} className="truncate text-xs font-medium text-ink hover:underline">
                        {bin.name}
                      </Link>
                      <p className="text-[11px] text-ink-muted">
                        {bin.daysUntilFull != null
                          ? `Full in about ${bin.daysUntilFull} days at its current rate`
                          : 'Not enough history to project'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-ink">
                      {formatPercent(bin.fillPercentage)}
                    </span>
                    <StatusBadge status={bin.status} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-ink-muted">Every bin in the network is on today&apos;s round.</p>
          )}
        </Card>
      </section>

      <RouteBriefingCard
        analysis={analysis}
        isRunning={analyse.isRunning}
        error={analyse.error}
        onRun={runBriefing}
      />

      <Card className="p-5">
        <CardHeader title="How these figures are produced" subtitle="Stated assumptions, not measurements" />

        <dl className="mt-4 grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Truck speed in traffic</dt>
            <dd className="font-medium tabular-nums text-ink">{assumptions.averageSpeedKmh} km/h</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Servicing per bin</dt>
            <dd className="font-medium tabular-nums text-ink">{assumptions.serviceMinutesPerStop} min</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Road detour factor</dt>
            <dd className="font-medium tabular-nums text-ink">× {assumptions.roadDistanceFactor}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Diesel while driving</dt>
            <dd className="font-medium tabular-nums text-ink">{assumptions.fuelLitresPerKm} L/km</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Diesel while servicing</dt>
            <dd className="font-medium tabular-nums text-ink">{assumptions.idleFuelLitresPerMinute} L/min</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">CO₂ per litre of diesel</dt>
            <dd className="font-medium tabular-nums text-ink">{assumptions.co2KgPerLitreDiesel} kg</dd>
          </div>
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
  );
}
