import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
});

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'dark' : 'light');
  } else {
    root.classList.add(theme);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('system');

  // Load theme preference from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('theme_preference')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.theme_preference) {
          const pref = data.theme_preference as Theme;
          setThemeState(pref);
          applyThemeClass(pref);
        }
      });
  }, [user]);

  // Apply theme on change & listen for system preference changes
  useEffect(() => {
    applyThemeClass(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyThemeClass('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      applyThemeClass(newTheme);
      if (user) {
        supabase
          .from('profiles')
          .update({ theme_preference: newTheme } as any)
          .eq('user_id', user.id)
          .then();
      }
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemePreference = () => useContext(ThemeContext);
