import { useEffect, useState } from 'react';

/** useState that persists to localStorage; falls back silently when storage is unavailable. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked (private mode, etc.) — keep in-memory state only.
    }
  }, [key, value]);

  return [value, setValue];
}
