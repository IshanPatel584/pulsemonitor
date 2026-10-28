import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getSessionGeneration } from '../lib/api';

const IDLE = { status: 'idle', checks: [], error: null };

/**
 * Check history for one monitor. Loads when `monitorId` changes and reloads
 * quietly whenever `refreshKey` changes (pass the monitor's lastChecked, which
 * the monitor list already polls, so history is refetched only after a new check).
 */
export function useMonitorHistory(monitorId, refreshKey) {
  const [state, setState] = useState(IDLE);
  const requestId = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      const generation = getSessionGeneration();
      if (!monitorId) {
        setState(IDLE);
        return;
      }
      if (!silent) setState({ status: 'loading', checks: [], error: null });

      try {
        const checks = await api.getMonitorHistory(monitorId);
        if (id === requestId.current && generation === getSessionGeneration()) setState({ status: 'ready', checks, error: null });
      } catch (err) {
        // A failed background refresh keeps the chart that's already on screen.
        if (id === requestId.current && generation === getSessionGeneration() && !silent) setState({ status: 'error', checks: [], error: err.message });
      }
    },
    [monitorId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Quiet reload when a new check lands for the same monitor. Switching monitors
  // is handled by the effect above, so skip it here to avoid a duplicate request.
  const last = useRef({ monitorId, refreshKey });
  useEffect(() => {
    const prev = last.current;
    last.current = { monitorId, refreshKey };
    if (prev.monitorId !== monitorId || prev.refreshKey === refreshKey) return;
    load({ silent: true });
  }, [monitorId, refreshKey, load]);

  return { ...state, reload: load };
}
