import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { FillMeter } from '../components/FillMeter.jsx';
import { SensorPanel } from '../components/SensorPanel.jsx';
import { CategoryLegend } from '../components/CategoryLegend.jsx';
import { RecentEvents } from '../components/RecentEvents.jsx';
import { AIInsightCard } from '../components/AIInsightCard.jsx';
import { WasteDonut } from '../components/charts/WasteDonut.jsx';
import { WasteTrendChart } from '../components/charts/WasteTrendChart.jsx';
import { DiversionMeter } from '../components/charts/DiversionMeter.jsx';
import { ErrorState, LoadingPage } from '../components/States.jsx';
import { formatKg, formatNumber, formatPercent, formatRelativeTime } from '../utils/format.js';

/** Section 24 - everything known about one Wasste bin. */
export default function BinDetail() {
  const { id } = useParams();
  const { data, error, isLoading, refetch } = useApi((signal) => api.bin(id, 30, signal), [id]);
  const [analysis, setAnalysis] = useState(null);

  const analyse = useAction(useCallback(() => api.analyse({ binId: id, days: 30 }), [id]));
  const simulate = useAction(useCallback(() => api.simulateSensor(id), [id]));

  const runAnalysis = async () => {
    const response = await analyse.run();
    if (response) setAnalysis(response.analysis);
  };

  const runSensor = async () => {
    const response = await simulate.run();
    if (response) refetch();
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load this Wasste bin" />;

  const { bin, categoryRows, impact, timeSeries, recentEvents } = data;
  const { measured, estimated } = impact;

  return (
    <div className="space-y-6">
      <nav>
        <Link to="/" className="text-xs text-ink-muted hover:text-ink">
          ← City overview
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{bin.name}</h1>
            <StatusBadge status={bin.status} />
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            {bin.location.address}
            {bin.location.neighbourhood ? ` · ${bin.location.neighbourhood}` : ''} ·{' '}
            {bin.location.latitude.toFixed(4)}, {bin.location.longitude.toFixed(4)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-ink-muted">Last updated</p>
          <p className="text-xs font-medium text-ink">{formatRelativeTime(bin.lastUpdated)}</p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-secondary">Fill level</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-ink">
            {formatPercent(bin.currentFillPercentage)}
          </p>
          <div className="mt-3">
            <FillMeter percentage={bin.currentFillPercentage} status={bin.status} showValue={false} />
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">
            Capacity {formatKg(bin.capacityKg)} · {formatKg(bin.sensors?.estimatedWeightKg || 0)} in bin
          </p>
        </Card>

        <MetricCard
          label="Collected to date"
          value={formatNumber(measured.totalWasteKg)}
          unit="kg"
          note={`${formatNumber(bin.totalEvents)} classified items`}
        />
        <MetricCard
          label="Landfill diversion"
          value={formatPercent(measured.diversionRatePct)}
          note={`${formatKg(measured.landfillDivertedKg)} diverted`}
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
        <Card className="flex flex-col p-5">
          <CardHeader title="Waste distribution" subtitle="Share of collected weight by sub-bin" />
          <WasteDonut rows={categoryRows} height={196} />
          <div className="mt-4 border-t border-hairline pt-4">
            <CategoryLegend rows={categoryRows} distributionPct={bin.wasteDistribution} compact />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Waste over time" subtitle="Daily kilograms per category at this location" />
          <div className="mt-4">
            <WasteTrendChart data={timeSeries} height={244} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SensorPanel bin={bin} onSimulate={runSensor} isSimulating={simulate.isRunning} />
          {simulate.error ? (
            <p className="mt-3 text-[11px] text-ink-secondary">{simulate.error.message}</p>
          ) : null}
        </Card>

        <Card className="p-5">
          <CardHeader title="Diversion" subtitle="Measured at this bin" />
          <div className="mt-4">
            <DiversionMeter
              divertedKg={measured.landfillDivertedKg}
              landfillKg={measured.landfillWasteKg}
            />
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Recent classifications" subtitle="Most recent items recognised here" />
          <div className="mt-1">
            <RecentEvents events={recentEvents} showBin={false} limit={8} />
          </div>
        </Card>
      </section>

      <AIInsightCard
        analysis={analysis}
        isRunning={analyse.isRunning}
        error={analyse.error}
        onRun={runAnalysis}
        title={`AI Sustainability Insight - ${bin.name}`}
      />
    </div>
  );
}
