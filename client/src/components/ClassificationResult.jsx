import { Link } from 'react-router-dom';
import { Card } from './Card.jsx';
import { SourceTag } from './SourceTag.jsx';
import { categoryMeta } from '../data/wasteCategories.js';
import { formatKg, formatPercent, titleCase } from '../utils/format.js';

/**
 * What the AI decided about one item (section 14).
 * Uncertainty is shown, never hidden: a low-confidence or UNKNOWN result says
 * so plainly instead of pretending the model is always right.
 */
export function ClassificationResult({ result }) {
  const { classification, source, notice, recorded, event, bin } = result;
  const meta = categoryMeta(classification.category);
  const isUnknown = classification.category === 'UNKNOWN';
  const confidencePct = Math.round(classification.confidence * 100);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">AI result</p>
        <SourceTag variant={source === 'DEMO' ? 'demo' : 'ai'} />
      </div>

      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {titleCase(classification.item)}
      </h2>

      <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-hairline p-3">
        <span
          aria-hidden="true"
          className="h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-muted">Sorted into</p>
          <p className="text-sm font-semibold text-ink">{meta.label}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-secondary">Confidence</span>
          <span className="text-sm font-semibold tabular-nums text-ink">{formatPercent(confidencePct)}</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-inset">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${confidencePct}%`, backgroundColor: meta.color }}
          />
        </div>
      </div>

      {classification.needsReview ? (
        <p className="mt-4 rounded-lg border border-hairline bg-inset p-3 text-xs leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">
            {isUnknown ? 'The AI could not identify this item. ' : 'The AI is uncertain about this classification. '}
          </span>
          Please verify the result before sorting.
          {isUnknown ? ' Nothing was added to a sub-bin.' : ''}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-3 rounded-lg border border-hairline bg-inset p-3 text-xs leading-relaxed text-ink-secondary">
          {notice}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Why</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{classification.reason}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-xs">
        <div>
          <dt className="text-ink-muted">Estimated weight</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatKg(classification.estimatedWeightKg, 3)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Recommended sub-bin</dt>
          <dd className="mt-0.5 font-semibold text-ink">{classification.recommendedBin || 'Manual review'}</dd>
        </div>
      </dl>

      {recorded && bin ? (
        <div className="mt-4 rounded-lg border border-hairline bg-inset p-3">
          <p className="text-xs font-semibold text-ink">Event recorded</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Added to{' '}
            <Link to={`/bins/${bin.id || bin._id}`} className="font-semibold text-ink hover:underline">
              {bin.name}
            </Link>
            . That bin is now {formatPercent(bin.currentFillPercentage)} full and has logged{' '}
            {bin.totalEvents} classified items.
          </p>
        </div>
      ) : null}

      {!recorded && !isUnknown ? (
        <p className="mt-4 text-[11px] text-ink-muted">
          Not recorded - pick a Wasste bin before analysing to add this to its statistics.
        </p>
      ) : null}

      {event ? (
        <p className="mt-3 text-[10px] text-ink-muted">Event ID {event._id}</p>
      ) : null}
    </Card>
  );
}
