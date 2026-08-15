import { Card } from './Card.jsx';
import { SourceTag } from './SourceTag.jsx';
import { formatRelativeTime } from '../utils/format.js';

const PRIORITY_META = {
  HIGH: { label: 'High priority', color: 'var(--status-critical)' },
  MEDIUM: { label: 'Medium priority', color: 'var(--status-warning)' },
  LOW: { label: 'Low priority', color: 'var(--status-offline)' },
};

/**
 * Gemini's operational briefing on a route the backend already solved.
 * The plan is fact; this card is interpretation, and is labelled as such.
 */
export function RouteBriefingCard({ analysis, isRunning, error, onRun }) {
  const isRules = analysis?.source === 'RULES';

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
            <span aria-hidden="true">🤖</span>
            AI dispatch briefing
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {analysis
              ? `Generated ${formatRelativeTime(analysis.generatedAt)}`
              : 'Gemini reads the solved route and briefs the depot supervisor.'}
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
              {isRunning ? 'Briefing…' : analysis ? 'Re-run briefing' : 'Brief the crew'}
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
          The route above is solved arithmetically. Ask the agent to explain the sequence, justify the
          bins it skipped, and flag anything the crew should watch for before rolling out.
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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Round summary</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{analysis.summary}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Why this sequence
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
              {analysis.sequenceRationale}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Actions for the supervisor
            </p>
            <ol className="mt-2.5 space-y-2.5">
              {(analysis.recommendations || []).map((recommendation, index) => {
                const meta = PRIORITY_META[recommendation.priority] || PRIORITY_META.MEDIUM;
                return (
                  <li key={`${recommendation.title}-${index}`} className="rounded-lg border border-hairline bg-inset p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xs font-semibold text-ink">{recommendation.title}</h3>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {recommendation.description}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          {analysis.risks?.length ? (
            <div className="mt-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Watch out for
              </p>
              <ul className="mt-2 space-y-1.5">
                {analysis.risks.map((risk, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
                    <span aria-hidden="true" style={{ color: 'var(--status-warning)' }}>
                      ▲
                    </span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
