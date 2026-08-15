import { Card } from './Card.jsx';
import { SourceTag } from './SourceTag.jsx';
import { formatKg, formatRelativeTime } from '../utils/format.js';

const PRIORITY_META = {
  HIGH: { label: 'High priority', color: 'var(--status-critical)' },
  MEDIUM: { label: 'Medium priority', color: 'var(--status-warning)' },
  LOW: { label: 'Low priority', color: 'var(--status-offline)' },
};

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

/**
 * The agent's output (sections 17 and 20).
 *
 * The four layers are kept visually distinct on purpose: what the AI observed,
 * what it concluded, what it recommends, and what the backend calculated. The
 * impact figures are never written by the model.
 */
export function AIInsightCard({ analysis, isRunning, error, onRun, title = 'AI Sustainability Insight' }) {
  const impact = analysis?.estimatedImpact;
  const isRules = analysis?.source === 'RULES';

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
            <span aria-hidden="true">🤖</span>
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {analysis
              ? `Generated ${formatRelativeTime(analysis.generatedAt)} from ${analysis.periodDays} days of measured data`
              : 'Gemini reads the measured data and proposes action.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {analysis ? <SourceTag variant={isRules ? 'rules' : 'ai'} /> : null}
          {onRun ? (
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {isRunning ? 'Analysing…' : analysis ? 'Re-run analysis' : 'Analyse sustainability'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-hairline bg-inset p-3 text-xs text-ink-secondary">
          {error.message}
        </p>
      ) : null}

      {isRunning && !analysis ? (
        <div className="mt-5 space-y-2" role="status">
          <div className="h-3 w-4/5 animate-pulse rounded bg-inset" />
          <div className="h-3 w-full animate-pulse rounded bg-inset" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-inset" />
        </div>
      ) : null}

      {!analysis && !isRunning && !error ? (
        <p className="mt-5 text-xs leading-relaxed text-ink-secondary">
          The sustainability agent reads this location&apos;s waste events, fill history and category
          mix, compares it with the city average, and returns recommended actions with an estimated
          monthly impact.
        </p>
      ) : null}

      {analysis ? (
        <div className="mt-5 flex flex-1 flex-col gap-5">
          {analysis.notice ? (
            <p className="rounded-lg border border-hairline bg-inset p-2.5 text-[11px] text-ink-secondary">
              {analysis.notice}
            </p>
          ) : null}

          <div className="border-l-2 pl-3.5" style={{ borderColor: 'var(--cat-organics)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Analysis</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{analysis.summary}</p>
            {analysis.keyFinding ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{analysis.keyFinding}</p>
            ) : null}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Recommended actions
            </p>
            <ol className="mt-2.5 space-y-2.5">
              {(analysis.recommendations || []).map((recommendation, index) => (
                <li
                  key={`${recommendation.title}-${index}`}
                  className="rounded-lg border border-hairline bg-inset p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xs font-semibold text-ink">{recommendation.title}</h3>
                    <PriorityBadge priority={recommendation.priority} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {recommendation.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {analysis.resourceRecovery?.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Resource recovery opportunities
              </p>
              <ul className="mt-2 space-y-1.5">
                {analysis.resourceRecovery.map((entry, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
                    <span aria-hidden="true" className="text-ink-muted">
                      ↻
                    </span>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {impact ? (
            <div className="mt-auto rounded-lg border border-hairline p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Potential monthly impact
                </p>
                <SourceTag variant="estimated" />
              </div>

              <dl className="mt-2.5 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-[10px] text-ink-muted">Waste avoided</dt>
                  <dd className="mt-0.5 text-base font-semibold text-ink">
                    {formatKg(impact.wasteAvoidedKgPerMonth)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-muted">Landfill diversion</dt>
                  <dd className="mt-0.5 text-base font-semibold text-ink">
                    {formatKg(impact.landfillDiversionKgPerMonth)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-muted">CO₂ avoided</dt>
                  <dd className="mt-0.5 text-base font-semibold text-ink">
                    {formatKg(impact.estimatedCO2AvoidedKgPerMonth)}
                  </dd>
                </div>
              </dl>

              <p className="mt-2.5 text-[10px] leading-relaxed text-ink-muted">
                Calculated by the Wasste backend from measured waste events using published emission
                factors. These are planning estimates, not measurements.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
