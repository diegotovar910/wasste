import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { BinCard } from '../components/BinCard.jsx';
import { CityMap } from '../components/CityMap.jsx';
import { CategoryLegend } from '../components/CategoryLegend.jsx';
import { RecentEvents } from '../components/RecentEvents.jsx';
import { AIInsightCard } from '../components/AIInsightCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { WasteDonut } from '../components/charts/WasteDonut.jsx';
import { WasteTrendChart } from '../components/charts/WasteTrendChart.jsx';
import { DiversionMeter } from '../components/charts/DiversionMeter.jsx';
import { ErrorState, LoadingPage } from '../components/States.jsx';
import { formatKg, formatNumber, formatPercent } from '../utils/format.js';

/** Section 21 - the city overview, and the first screen of the demo. */
export default function Dashboard() {
  const { data, error, isLoading, refetch } = useApi((signal) => api.dashboard(30, signal), []);
  const [analysis, setAnalysis] = useState(null);

  const analyse = useAction(useCallback(() => api.analyse({ days: 30 }), []));

  const runAnalysis = async () => {
    const response = await analyse.run();
    if (response) setAnalysis(response.analysis);
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load the city dashboard" />;

  const { overview, bins, timeSeries, categoryRows, topLocations, fillLevels, recentEvents } = data;
  const { measured, estimated, distributionPct } = overview;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">City waste overview</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {overview.binCount} Wasste bins · {formatNumber(overview.totalEvents)} items classified ·
            last {data.periodDays} days
          </p>
        </div>
        <Link
          to="/scan"
          className="rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-85"
        >
          Scan an item
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          label="Total waste collected"
          value={formatNumber(measured.totalWasteKg)}
          unit="kg"
          hero
          note="Sum of every recorded waste event"
          className="sm:col-span-2 lg:col-span-2"
        />
        <MetricCard
          label="Active Wasste bins"
          value={formatNumber(overview.activeBinCount)}
          note={`${overview.binsNeedingCollection} need collection`}
        />
        <MetricCard
          label="Landfill diversion"
          value={formatPercent(measured.diversionRatePct)}
          note={`${formatKg(measured.landfillDivertedKg)} kept out of landfill`}
        />
        <MetricCard
          label="Waste avoidable"
          value={formatNumber(estimated.wasteAvoidableKgPerMonth)}
          unit="kg/mo"
          variant="estimated"
          note="If reuse programmes were in place"
        />
        <MetricCard
          label="Estimated CO₂ avoided"
          value={formatNumber(estimated.co2AvoidedKg)}
          unit="kg"
          variant="estimated"
          note="Modelled from diverted material"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Waste collected over time"
            subtitle={`Daily kilograms per category across all bins, last ${data.periodDays} days`}
          />
          <div className="mt-4">
            <WasteTrendChart data={timeSeries} />
          </div>
          <div className="mt-4 border-t border-hairline pt-4">
            <CategoryLegend rows={categoryRows} distributionPct={distributionPct} />
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <CardHeader title="Waste distribution" subtitle="Share of collected weight by sub-bin" />
          <WasteDonut rows={categoryRows} height={196} />
          <div className="mt-4 border-t border-hairline pt-4">
            <CategoryLegend rows={categoryRows} distributionPct={distributionPct} compact />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Wasste bin network"
            subtitle="Select a bin to open its detail view"
          />
          <div className="mt-4">
            <CityMap bins={bins} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <CardHeader title="Landfill diversion" subtitle="Measured across the whole network" />
            <div className="mt-4">
              <DiversionMeter
                divertedKg={measured.landfillDivertedKg}
                landfillKg={measured.landfillWasteKg}
              />
            </div>
          </Card>

          <Card className="flex-1 p-5">
            <CardHeader title="Collection queue" subtitle="Fullest bins first" />
            <ul className="mt-3 divide-y divide-hairline">
              {fillLevels.slice(0, 5).map((bin) => (
                <li key={bin.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/bins/${bin.id}`} className="truncate text-xs font-medium text-ink hover:underline">
                      {bin.name}
                    </Link>
                    <p className="text-[11px] text-ink-muted">{formatKg(bin.estimatedWeightKg)} in bin</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink">
                    {formatPercent(bin.fillPercentage)}
                  </span>
                  <StatusBadge status={bin.status} size="sm" />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AIInsightCard
            analysis={analysis}
            isRunning={analyse.isRunning}
            error={analyse.error}
            onRun={runAnalysis}
            title="AI Sustainability Insight - city wide"
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <CardHeader title="Top waste-producing locations" subtitle="By total weight collected" />
            <ol className="mt-3 space-y-2.5">
              {topLocations.map((location, index) => (
                <li key={location.id} className="flex items-center gap-3">
                  <span className="w-4 text-xs tabular-nums text-ink-muted">{index + 1}</span>
                  <Link to={`/bins/${location.id}`} className="min-w-0 flex-1 truncate text-xs text-ink hover:underline">
                    {location.address}
                  </Link>
                  <span className="text-xs font-semibold tabular-nums text-ink">
                    {formatKg(location.totalWasteKg)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="flex-1 p-5">
            <CardHeader title="Recent classifications" subtitle="Live feed from across the network" />
            <div className="mt-1">
              <RecentEvents events={recentEvents} />
            </div>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-ink">All Wasste bins</h2>
          <p className="text-xs text-ink-muted">{bins.length} bins in the network</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bins.map((bin) => (
            <BinCard key={bin.id} bin={bin} />
          ))}
        </div>
      </section>
    </div>
  );
}
