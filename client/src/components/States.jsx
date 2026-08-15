import { Card } from './Card.jsx';

/** Skeleton block used while a page loads. */
export function LoadingBlock({ height = 'h-32', className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-hairline bg-inset ${height} ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingPage({ label = 'Loading Wasste data' }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <LoadingBlock key={index} height="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingBlock height="h-80" className="lg:col-span-2" />
        <LoadingBlock height="h-80" />
      </div>
    </div>
  );
}

/**
 * A failed request never leaves a blank screen: it explains what broke and
 * offers the one action that might fix it (section 28).
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const isOffline = error?.status === 0;
  const isDatabase = error?.status === 503;

  const hint = isOffline
    ? 'The Wasste API did not respond. Start it with `npm run dev` in the server folder.'
    : isDatabase
      ? 'The API is running but cannot reach MongoDB. Start MongoDB, then seed it with `npm run seed`.'
      : null;

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-secondary">
        {error?.message || 'The request could not be completed.'}
      </p>
      {hint ? <p className="mt-2 text-xs text-ink-muted">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-opacity hover:opacity-85"
        >
          Try again
        </button>
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
