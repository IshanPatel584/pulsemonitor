import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, bumpSessionGeneration, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

const USER_KEY = 'pm.user';
const NAMES_KEY = 'pm.knownNames';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — the session still works, the display name just won't persist.
  }
}

/**
 * Accepts only the fields the UI uses, with the right types. Anything else in
 * storage (hand-edited, old format, another app) is ignored rather than crashing.
 */
function sanitizeUser(value) {
  if (!value || typeof value !== 'object') return null;
  const id = typeof value.id === 'string' && /^[a-f0-9]{24}$/i.test(value.id) ? value.id : null;
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const username = typeof value.username === 'string' && value.username.trim() ? value.username.trim() : null;
  // Only ever comes from GET /api/me. It decides which links are shown; the
  // server checks the real role on every admin request.
  const role = value.role === 'admin' || value.role === 'client' ? value.role : null;
  if (!id && !email && !username) return null;
  return { id, email, username, role };
}

function parseStoredUser(raw) {
  try {
    return raw ? sanitizeUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Session state backed by the backend's httpOnly JWT cookie.
 *
 * The session is probed once with GET /api/me (200 = signed in, 401 = signed
 * out, anything else = error, which is *not* treated as signed out). It also
 * returns the account's username, email and role, which replace whatever was
 * stored locally, so a stale or hand-edited role in storage is never used.
 *
 * status: checking | authenticated | anonymous | error
 * notice: why the last session ended — 'expired' | 'elsewhere' (login page), 'signed_out' | 'logout_failed' (landing page) | null
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [user, setUser] = useState(() => sanitizeUser(readJson(USER_KEY, null)));

  const statusRef = useRef(status);
  statusRef.current = status;
  const userRef = useRef(user);
  userRef.current = user;

  const endSession = useCallback((reason = null) => {
    bumpSessionGeneration();
    writeJson(USER_KEY, null);
    setUser(null);
    setStatus('anonymous');
    setNotice(reason);
  }, []);

  // Server profile → state and storage (other tabs ignore it unless the id changes).
  const applyProfile = useCallback((profile) => {
    const clean = sanitizeUser(profile);
    if (!clean) return;
    writeJson(USER_KEY, clean);
    setUser(clean);
  }, []);

  const checkSession = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      applyProfile(await api.me());
      setStatus('authenticated');
    } catch (err) {
      if (err.status === 401) endSession();
      else {
        setError(err.message);
        setStatus('error');
      }
    }
  }, [endSession, applyProfile]);

  /**
   * Re-reads the profile without leaving the page, e.g. after an admin request
   * answered 403 because the role was removed. Errors are ignored: a 401 ends
   * the session through the unauthorized handler anyway.
   */
  const refreshProfile = useCallback(async () => {
    try {
      applyProfile(await api.me());
    } catch {
      // Keep the current profile; the page already shows the request's error.
    }
  }, [applyProfile]);

  // One probe on load (and on explicit retry) — never in a loop.
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Any 401 from a request of the current session ends it once. Further 401s
  // (parallel polls) find the session already anonymous and do nothing.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current === 'authenticated') endSession('expired');
      else if (statusRef.current === 'checking') endSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Keep tabs in sync: sign-out or a different account in another tab.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== USER_KEY) return;
      const next = parseStoredUser(event.newValue);
      if (!next) {
        if (statusRef.current === 'authenticated') endSession('elsewhere');
        return;
      }
      if (next.id !== userRef.current?.id) {
        bumpSessionGeneration();
        setUser(next);
        checkSession();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkSession, endSession]);

  const startSession = useCallback((nextUser) => {
    bumpSessionGeneration();
    const clean = sanitizeUser(nextUser);
    writeJson(USER_KEY, clean);
    setUser(clean);
    setError(null);
    setNotice(null);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const data = await api.login({ email, password });
      const normalized = email.trim().toLowerCase();
      const knownNames = readJson(NAMES_KEY, {});
      const knownName = knownNames && typeof knownNames === 'object' ? knownNames[normalized] : null;
      // The profile (with the role) comes from the server; if that request
      // fails, sign in with the form values and no role (no admin links).
      const profile = await api.me().catch(() => null);
      startSession(profile ?? { id: data?.user, email: normalized, username: knownName });
    },
    [startSession],
  );

  const signup = useCallback(
    async ({ username, email, password }) => {
      const data = await api.signup({ username, email, password });
      const normalized = email.trim().toLowerCase();
      const knownNames = readJson(NAMES_KEY, {});
      writeJson(NAMES_KEY, { ...(knownNames && typeof knownNames === 'object' ? knownNames : {}), [normalized]: username.trim() });
      const profile = await api.me().catch(() => null);
      startSession(profile ?? { id: data?.user, email: normalized, username: username.trim() });
    },
    [startSession],
  );

  /**
   * Signs out and goes to the public landing page.
   *
   * The local session ends first and, in the same synchronous step, the router
   * moves to `/`. React batches both into one render, so the protected page is
   * never rendered signed-out (which would bounce to /login) and no stale
   * signed-in UI is shown. endSession bumps the session generation, so requests
   * still in flight can't write data or trigger a 401 afterwards.
   * Only then is the server asked to clear its httpOnly cookie; if it can't be
   * reached, the landing page explains that the server session may still exist.
   */
  const logout = useCallback(async () => {
    endSession('signed_out');
    navigate('/', { replace: true });
    try {
      await api.logout();
    } catch {
      setNotice('logout_failed');
    }
  }, [endSession, navigate]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const isAdmin = user?.role === 'admin';

  const value = useMemo(
    () => ({ status, error, notice, user, isAdmin, login, signup, logout, checkSession, refreshProfile, dismissNotice }),
    [status, error, notice, user, isAdmin, login, signup, logout, checkSession, refreshProfile, dismissNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
