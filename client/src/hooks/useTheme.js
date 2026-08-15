import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wasste-theme';

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Light/dark toggle. No stored choice means "follow the operating system". */
export function useTheme() {
  const [theme, setTheme] = useState(() => readStored() || 'system');

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable - the attribute still applies for this session */
    }
  }, [theme]);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const toggle = useCallback(() => setTheme(isDark ? 'light' : 'dark'), [isDark]);

  return { theme, isDark, toggle };
}
