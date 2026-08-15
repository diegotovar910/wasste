import { Card } from './Card.jsx';
import { SourceTag } from './SourceTag.jsx';
import { formatDuration, formatKg, formatKm, formatRelativeTime } from '../utils/format.js';

/** Plain-language verdict on the AI's route against the solver's. */
const VERDICT = {
  EQUAL: (comparison) => ({
    tone: 'var(--status-offline)',
    text: `Same distance as the planner's route (${comparison.distanceDeltaKm === 0 ? 'identical cost' : 'within 10 m'}). A round trip measures the same driven in reverse, so this is common.`,
  }),
  AI_SHORTER: (comparison) => ({
    tone: 'var(--status-good)',
    text: `${formatKm(Math.abs(comparison.distanceDeltaKm))} shorter than the planner's route, saving about ${formatDuration(Math.abs(comparison.minutesDelta))}.`,
  }),
  SOLVER_SHORTER: (comparison) => ({
    tone: 'var(--status-warning)',
    text: `The planner's route is ${formatKm(comparison.distanceDeltaKm)} shorter, about ${formatDuration(comparison.minutesDelta)} quicker. Use this order only if its reasoning matters more than distance.`,
  }),
};

const formatSettingValue = (value) => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value === 0) return 'no limit';
  return String(value);
};

const PRIORITY_META = {
  HIGH: { label: 'High priority', color: 'var(--status-critical)' },
  MEDIUM: { label: 'Medium priority', color: 'var(--status-warning)' },
  LOW: { label: 'Low priority', color: 'var(--status-offline)' },
};

/**
 * Gemini's operational briefing on a route the backend already solved.
 * The plan is fact; this card is interpretation, and is labelled as such.
 */
export function RouteBriefingCard({ analysis, isRunning, error, onRun, onApplySettings }) {
  const isRules = analysis?.source === 'RULES';
  const proposal = analysis?.proposedRoute;
  const settings = analysis?.recommendedSettings;
  const verdict = proposal ? VERDICT[proposal.comparison.verdict](proposal.comparison) : null;

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

          {proposal ? (
            <div className="rounded-lg border border-hairline p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  The AI&apos;s own stop order
                </p>
                <SourceTag variant="measured">Costed by the planner</SourceTag>
              </div>

              <ol className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                {proposal.stops.map((stop, index) => (
                  <li key={stop.binId} className="flex items-center gap-1.5">
                    <span
                      className="rounded border border-hairline bg-inset px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink"
                      title={`${stop.name} · ${stop.fillPercentage}% · arrive ${stop.etaClock}`}
                    >
                      {stop.code}
                    </span>
                    {index < proposal.stops.length - 1 ? (
                      <span aria-hidden="true" className="text-[11px] text-ink-muted">→</span>
                    ) : null}
                  </li>
                ))}
              </ol>

              {proposal.rationale ? (
                <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">{proposal.rationale}</p>
              ) : null}

              <p className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-ink-secondary">
                <span aria-hidden="true" style={{ color: verdict.tone }}>●</span>
                <span>
                  <strong className="font-semibold text-ink">
                    {proposal.cost.distanceKm} km · {formatDuration(proposal.cost.totalMinutes)} ·{' '}
                    {formatKg(proposal.cost.co2Kg, 1)} CO₂.
                  </strong>{' '}
                  {verdict.text}
                </span>
              </p>

              {proposal.repaired ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                  The proposal needed repairing before it could be costed
                  {proposal.unknownCodes.length ? ` (unknown bins: ${proposal.unknownCodes.join(', ')})` : ''}
                  {proposal.missingCodes.length ? ` (missing bins appended: ${proposal.missingCodes.join(', ')})` : ''}
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          {settings?.rationale ? (
            <div className="rounded-lg border border-hairline p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Settings the AI would use next
              </p>

              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{settings.rationale}</p>

              {settings.changes?.length ? (
                <>
                  <ul className="mt-3 space-y-1.5">
                    {settings.changes.map((change) => (
                      <li key={change.key} className="flex items-center gap-2 text-xs">
                        <span className="text-ink-secondary">{change.label}</span>
                        <span className="ml-auto flex items-center gap-1.5 tabular-nums">
                          <span className="text-ink-muted line-through">{formatSettingValue(change.from)}</span>
                          <span aria-hidden="true" className="text-ink-muted">→</span>
                          <span className="font-semibold text-ink">{formatSettingValue(change.to)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {settings.preview ? (
                    <p className="mt-3 rounded-lg bg-inset p-2.5 text-[11px] leading-relaxed text-ink-secondary">
                      Applying these gives{' '}
                      <strong className="font-semibold text-ink">
                        {settings.preview.stopCount} stops · {settings.preview.distanceKm} km ·{' '}
                        {formatDuration(settings.preview.totalMinutes)} · {formatKg(settings.preview.co2Kg, 1)} CO₂
                      </strong>
                      {settings.preview.droppedByConstraint > 0
                        ? `, with ${settings.preview.droppedByConstraint} bin(s) still cut by a limit.`
                        : ', with no bins cut by a limit.'}
                    </p>
                  ) : null}

                  {onApplySettings ? (
                    <button
                      type="button"
                      onClick={() => onApplySettings(settings.settings)}
                      className="mt-3 w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-xs font-semibold text-ink transition-opacity hover:opacity-80"
                    >
                      Apply these settings
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-[11px] text-ink-muted">
                  No parameter change suggested — the current settings already fit.
                </p>
              )}
            </div>
          ) : null}

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
