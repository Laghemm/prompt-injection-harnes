import { useEffect, useState } from "react";

export interface FetchState<T> {
  data?: T;
  loading: boolean;
  error?: string;
  reload: () => void;
}

/** Minimal data-fetching hook: no caching layer (TanStack Query would be the real choice at scale). */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fn()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Request failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
