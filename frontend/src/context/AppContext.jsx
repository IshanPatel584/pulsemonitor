import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, getSessionGeneration, normalizeMonitor, toMonitorPayload } from '../lib/api';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

function profileFromUser(user) {
  return {
    name: user?.username || user?.email?.split('@')[0] || 'Account',
    email: user?.email ?? '',
    role: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

// How often to re-fetch monitors and incidents so new check results appear without a reload.
const MONITOR_POLL_MS = 15_000;

/** App state. Monitors and incidents come from the Express API. */
export function AppProvider({ children }) {
  const { status: authStatus, user } = useAuth();

  const [monitors, setMonitors] = useState([]);
  const [monitorsStatus, setMonitorsStatus] = useState('idle'); // idle | loading | ready | error
  const [monitorsError, setMonitorsError] = useState(null);

  const [incidents, setIncidents] = useState([]);
  const [incidentsStatus, setIncidentsStatus] = useState('idle'); // idle | loading | ready | error
  const [incidentsError, setIncidentsError] = useState(null);

  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [monitorModal, setMonitorModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', monitor }
  const [toasts, setToasts] = useState([]);

  useEffect(() => setProfile(profileFromUser(user)), [user]);

  // Mark the toast as leaving so it can play its exit animation, then remove it.
  const dismissToast = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 180);
  }, []);

  const notify = useCallback(
    (message, tone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  /**
   * Fetch the signed-in user's monitors. Returns the normalized list, or null
   * when the session changed while the request was in flight (result dropped).
   * `silent` refreshes keep the current list on screen while loading and,
   * if they fail, leave it in place instead of switching to the error state.
   */
  const refreshMonitors = useCallback(async ({ silent = false } = {}) => {
    const generation = getSessionGeneration();
    if (!silent) setMonitorsStatus('loading');
    try {
      const list = (await api.getMonitors()).map(normalizeMonitor);
      if (generation !== getSessionGeneration()) return null;
      setMonitors(list);
      setMonitorsStatus('ready');
      setMonitorsError(null);
      return list;
    } catch (err) {
      if (generation !== getSessionGeneration()) return null;
      if (!silent) {
        setMonitorsError(err.message);
        setMonitorsStatus('error');
      }
      throw err;
    }
  }, []);

  /** Fetch the signed-in user's incidents (newest first). Same `silent` semantics as refreshMonitors. */
  const refreshIncidents = useCallback(async ({ silent = false } = {}) => {
    const generation = getSessionGeneration();
    if (!silent) setIncidentsStatus('loading');
    try {
      const list = await api.getIncidents();
      if (generation !== getSessionGeneration()) return null;
      setIncidents(list);
      setIncidentsStatus('ready');
      setIncidentsError(null);
      return list;
    } catch (err) {
      if (generation !== getSessionGeneration()) return null;
      if (!silent) {
        setIncidentsError(err.message);
        setIncidentsStatus('error');
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      refreshMonitors().catch(() => {});
      refreshIncidents().catch(() => {});
    } else {
      // Signed out, re-checking, or switching accounts: never keep the previous session's data.
      setMonitors([]);
      setMonitorsStatus('idle');
      setIncidents([]);
      setIncidentsStatus('idle');
    }
  }, [authStatus, refreshMonitors, refreshIncidents]);

  // The backend checks monitors on their own schedule, so poll for the latest
  // results while signed in. Paused while the tab is hidden; refreshed on return.
  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined;

    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      refreshMonitors({ silent: true }).catch(() => {});
      refreshIncidents({ silent: true }).catch(() => {});
    };
    const id = setInterval(poll, MONITOR_POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [authStatus, refreshMonitors, refreshIncidents]);

  // POST only returns the new id, so the list is refetched to get the full document.
  const createMonitor = useCallback(
    async (values) => {
      await api.createMonitor(toMonitorPayload(values));
      await refreshMonitors({ silent: true }).catch(() => {});
    },
    [refreshMonitors],
  );

  const updateMonitor = useCallback(
    async (id, values) => {
      await api.updateMonitor(id, toMonitorPayload(values));
      await refreshMonitors({ silent: true }).catch(() => {});
    },
    [refreshMonitors],
  );

  const deleteMonitor = useCallback(
    async (id) => {
      try {
        await api.deleteMonitor(id);
      } catch (err) {
        // The backend's delete handler deletes the document and then throws while
        // building its response, so it answers 400 even on success. Confirm by refetching.
        if (err instanceof ApiError && err.status === 400) {
          const list = await refreshMonitors({ silent: true });
          if (list && !list.some((m) => m.id === id)) {
            refreshIncidents({ silent: true }).catch(() => {});
            return;
          }
        }
        throw err;
      }
      await refreshMonitors({ silent: true }).catch(() => {});
      refreshIncidents({ silent: true }).catch(() => {});
    },
    [refreshMonitors, refreshIncidents],
  );

  const openAddMonitor = useCallback(() => setMonitorModal({ mode: 'create' }), []);
  const openEditMonitor = useCallback((monitor) => setMonitorModal({ mode: 'edit', monitor }), []);
  const closeMonitorModal = useCallback(() => setMonitorModal(null), []);

  const value = useMemo(
    () => ({
      monitors,
      monitorsStatus,
      monitorsError,
      refreshMonitors,
      createMonitor,
      updateMonitor,
      deleteMonitor,
      incidents,
      incidentsStatus,
      incidentsError,
      refreshIncidents,
      profile,
      setProfile,
      monitorModal,
      openAddMonitor,
      openEditMonitor,
      closeMonitorModal,
      toasts,
      notify,
      dismissToast,
    }),
    [
      monitors,
      monitorsStatus,
      monitorsError,
      refreshMonitors,
      createMonitor,
      updateMonitor,
      deleteMonitor,
      incidents,
      incidentsStatus,
      incidentsError,
      refreshIncidents,
      profile,
      monitorModal,
      openAddMonitor,
      openEditMonitor,
      closeMonitorModal,
      toasts,
      notify,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
