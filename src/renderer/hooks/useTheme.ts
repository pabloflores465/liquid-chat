import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types/electron';

type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  cycleTheme: () => Promise<void>;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // Load initial theme
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      const settings = await window.electron.settings.get();
      setThemeState(settings.theme);

      const systemDark = await window.electron.theme.getSystem();
      const effectiveDark = settings.theme === 'system' ? systemDark : settings.theme === 'dark';
      setIsDark(effectiveDark);
      document.documentElement.setAttribute('data-theme', effectiveDark ? 'dark' : 'light');
    };

    loadTheme();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const unsubscribe = window.electron.theme.onChanged((systemDark) => {
      if (theme === 'system') {
        setIsDark(systemDark);
        document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
      }
    });

    return unsubscribe;
  }, [theme]);

  const setTheme = useCallback(async (newTheme: Theme): Promise<void> => {
    setThemeState(newTheme);
    await window.electron.settings.update({ theme: newTheme });

    const systemDark = await window.electron.theme.getSystem();
    const effectiveDark = newTheme === 'system' ? systemDark : newTheme === 'dark';
    setIsDark(effectiveDark);
    document.documentElement.setAttribute('data-theme', effectiveDark ? 'dark' : 'light');
  }, []);

  const cycleTheme = useCallback(async (): Promise<void> => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    await setTheme(nextTheme);
  }, [theme, setTheme]);

  return { theme, isDark, setTheme, cycleTheme };
}
