import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessionGeneration } from '../lib/api';

/**
 * Loads one admin API resource. `key` identifies the request (e.g. a query
 * string); when it changes the data is re-fetched and responses for older keys
 * are dropped, so fast typing or paging never shows out-of-order results.
 * While re-fetching, the previous data stays on screen (`refreshing` is true);
 * `status` is 'loading' only when there is nothing to show yet.
 *
 * A 403 means the account is no longer an admin: the profile is re-read so
 * the Admin Portal links disappear, and `forbidden` lets the page say so.
 */
export function useAdminResource(fetcher, key) {
  const { refreshProfile } = useAuth();
  const [state, setState] = useState({ status: 'loading', data: null, error: null, forbidden: false, refreshing: false });
  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = (latest.current += 1);
    const generation = getSessionGeneration();
    setState((s) => ({ ...s, refreshing: true, ...(s.data ? {} : { status: 'loading', error: null }) }));
    try {
      const data = await fetcherRef.current();
      if (id !== latest.current || generation !== getSessionGeneration()) return;
      setState({ status: 'ready', data, error: null, forbidden: false, refreshing: false });
    } catch (err) {
      if (id !== latest.current || generation !== getSessionGeneration()) return;
      const forbidden = err?.status === 403;
      if (forbidden) refreshProfile();
      // Old data is dropped: it may belong to another page or filter, and after
      // a failure (backend down, session expired) it would no longer be current.
      setState({ status: 'error', data: null, error: err?.message ?? 'Something went wrong.', forbidden, refreshing: false });
    }
  }, [refreshProfile]);

  useEffect(() => {
    load();
  }, [load, key]);

  return { ...state, reload: load };
}
