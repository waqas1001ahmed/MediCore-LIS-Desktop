import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError } from '../api/client.js';

/**
 * Declarative data fetching hook.
 *
 * @param {(signal?: AbortSignal) => Promise<any>} fetcher resolves to the payload
 * @param {any[]} deps dependency list that re-triggers the request
 * @param {{ enabled?: boolean, initial?: any }} options
 */
export function useFetch(fetcher, deps = [], options = {}) {
  const { enabled = true, initial = null } = options;
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve(fetcherRef.current())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(apiError(fetchError, 'Unable to load data'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadIndex]);

  return { data, loading, error, reload, setData };
}

/** Imperative mutation helper with pending/error state. */
export function useMutation(mutator) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        return await mutator(...args);
      } catch (mutationError) {
        const message = apiError(mutationError);
        setError(message);
        throw mutationError;
      } finally {
        setPending(false);
      }
    },
    [mutator],
  );

  return { mutate, pending, error, setError };
}
