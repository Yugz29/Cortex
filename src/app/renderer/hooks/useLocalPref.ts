import { useState } from 'react';

/**
 * Like useState but backed by localStorage.
 * Value is read once on mount; writes are synchronous.
 */
export function useLocalPref<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  function set(v: T) {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* non-fatal */ }
  }

  return [value, set];
}
