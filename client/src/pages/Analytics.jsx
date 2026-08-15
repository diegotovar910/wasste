import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { CategoryLegend } from '../components/CategoryLegend.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { WasteDonut } from '../components/charts/WasteDonut.jsx';
import { WasteTrendChart } from '../components/charts/WasteTrendChart.jsx';
import { CategoryBarChart } from '../components/charts/CategoryBarChart.jsx';
import { FillLevelChart } from '../components/charts/FillLevelChart.jsx';
import { DiversionMeter } from '../components/charts/DiversionMeter.jsx';
import { ErrorState, LoadingPage } from '../components/States.jsx';
import { CATEGORY_LIST } from '../data/wasteCategories.js';
import { formatKg, formatNumber, formatPercent } from '../utils/format.js';

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

/** Section 23 - the analytics view. */
export default function Analytics() {
  const [days, setDays] = useState(30);
  const [showTable, setShowTable] = useState(false);

  const { data, error, isLoading, refetch } = useApi((signal) => api.dashboard(days, signal), [days]);

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load analytics" />;

  const { overview, timeSeries, categoryRows, periodCategoryRows, fillLevels, topLocations } = data;
  const { measured, distributionPct } = overview;

  const periodTotalKg = periodCategoryRows.reduce((sum, row) => sum + row.kg, 0);
  const periodItems = periodCategoryRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Waste analytics</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {formatKg(periodTotalKg)} from {formatNumber(periodItems)} classified items in the selected
            period.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-hairline p-0.5" role="group" aria-label="Time range">
            {PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                onClick={() => setDays(period.days)}
                aria-pressed={days === period.days}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  days === period.days ? 'bg-inset text-ink' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowTable((current) => !current)}
            className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
          >
            {showTable ? 'Hide data table' : 'Show data table'}
          </button>
        </div>
      </header>

      <Card className="p-5">
        <CardHeader
          title="Waste over time"
          subtitle={`Daily kilograms per category, last ${days} days`}
        />
        <div className="mt-4">
          <WasteTrendChart data={timeSeries} height={300} />
        </div>
        <div className="mt-4 border-t border-hairline pt-4">
          <CategoryLegend rows={periodCategoryRows} distributionPct={distributionPct} />
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Waste by category"
            subtitle={`Kilograms collected in the last ${days} days`}
          />
          <div className="mt-4">
            <CategoryBarChart rows={periodCategoryRows} height={280} />
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <CardHeader title="Waste distribution" subtitle="All-time share by sub-bin" />
          <WasteDonut rows={categoryRows} height={200} />
          <div className="mt-4 border-t border-hairline pt-4">
            <CategoryLegend rows={categoryRows} distributionPct={distributionPct} compact />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Bin fill levels" subtitle="Fullest first - this is the collection queue" />
          <div className="mt-4">
            <FillLevelChart bins={fillLevels} height={Math.max(240, fillLevels.length * 38)} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <CardHeader title="Landfill diversion" subtitle="All-time, network wide" />
            <div className="mt-4">
              <DiversionMeter
                divertedKg={measured.landfillDivertedKg}
                landfillKg={measured.landfillWasteKg}
              />
            </div>
          </Card>

          <Card className="flex-1 p-5">
            <CardHeader title="Top waste-producing locations" subtitle="By total weight collected" />
            <ol className="mt-3 space-y-3">
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
        </div>
      </section>

      {showTable ? (
        <Card className="p-5">
          <CardHeader title="Data table" subtitle="Every figure plotted above, in text" />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <caption className="sr-only">Waste collected by category</caption>
              <thead>
                <tr className="border-b border-hairline text-ink-muted">
                  <th scope="col" className="py-2 font-medium">Category</th>
                  <th scope="col" className="py-2 text-right font-medium">Last {days} days (kg)</th>
                  <th scope="col" className="py-2 text-right font-medium">Items</th>
                  <th scope="col" className="py-2 text-right font-medium">All-time (kg)</th>
                  <th scope="col" className="py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {CATEGORY_LIST.map((category) => {
                  const period = periodCategoryRows.find((row) => row.key === category.key) || {};
                  const allTime = categoryRows.find((row) => row.key === category.key) || {};

                  return (
                    <tr key={category.key}>
                      <th scope="row" className="py-2 font-medium text-ink">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.label}
                        </span>
                      </th>
                      <td className="py-2 text-right tabular-nums text-ink">{formatNumber(period.kg || 0, 1)}</td>
                      <td className="py-2 text-right tabular-nums text-ink-secondary">
                        {formatNumber(period.count || 0)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink">{formatNumber(allTime.kg || 0, 1)}</td>
                      <td className="py-2 text-right tabular-nums text-ink-secondary">
                        {formatPercent(distributionPct[category.key] ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <caption className="sr-only">Bin fill levels</caption>
              <thead>
                <tr className="border-b border-hairline text-ink-muted">
                  <th scope="col" className="py-2 font-medium">Wasste bin</th>
                  <th scope="col" className="py-2 text-right font-medium">Fill</th>
                  <th scope="col" className="py-2 text-right font-medium">In bin</th>
                  <th scope="col" className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {fillLevels.map((bin) => (
                  <tr key={bin.id}>
                    <th scope="row" className="py-2 font-medium text-ink">
                      <Link to={`/bins/${bin.id}`} className="hover:underline">
                        {bin.name}
                      </Link>
                    </th>
                    <td className="py-2 text-right tabular-nums text-ink">{formatPercent(bin.fillPercentage)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-secondary">
                      {formatKg(bin.estimatedWeightKg)}
                    </td>
                    <td className="py-2 text-right">
                      <StatusBadge status={bin.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
