import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetch-on-mount with loading, error and refetch. Every page uses this so a
 * failed request always produces an error state instead of a blank screen
 * (section 28).
 */
export function useApi(fetcher, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestRef = useRef(0);

  const run = useCallback(
    async (signal) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetcher(signal);
        if (requestRef.current === requestId) setData(result);
      } catch (caught) {
        if (caught.name === 'AbortError') return;
        if (requestRef.current === requestId) setError(caught);
      } finally {
        if (requestRef.current === requestId) setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  );

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
  }, [run]);

  /** Merges a fresh payload in without a full reload - used after a scan. */
  const patch = useCallback((updater) => {
    setData((current) => (current ? updater(current) : current));
  }, []);

  return { data, error, isLoading, refetch: () => run(), patch };
}

/** Small helper for one-off actions (classify, analyse, simulate). */
export function useAction(action) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (...args) => {
      setIsRunning(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        setError(caught);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [action],
  );

  return { run, isRunning, error, clearError: () => setError(null) };
}
