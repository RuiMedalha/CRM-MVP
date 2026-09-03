import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getCompanySettings, upsertCompanySettings } from '@/integrations/directus/settings';

export type ThemeAccent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeRadius = 'none' | 'sm' | 'md' | 'lg';
export type ThemeDensity = 'compact' | 'comfortable';

export interface ThemeConfig {
  accent: ThemeAccent;
  mode: ThemeMode;
  radius: ThemeRadius;
  density: ThemeDensity;
  logoUrl: string | null;
}

const DEFAULT_THEME: ThemeConfig = {
  accent: 'indigo',
  mode: 'auto',
  radius: 'md',
  density: 'comfortable',
  logoUrl: null,
};

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (config: Partial<ThemeConfig>) => void;
  saveTheme: () => Promise<void>;
  loading: boolean;
  resolvedMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
  return ctx;
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(config: ThemeConfig) {
  const root = document.documentElement;
  root.setAttribute('data-theme-accent', config.accent);
  root.setAttribute('data-theme-radius', config.radius);
  root.setAttribute('data-theme-density', config.density);

  const resolved = resolveMode(config.mode);
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  // Load from company_settings
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCompanySettings().then((settings) => {
      if (cancelled) return;
      if (settings) {
        const loaded: ThemeConfig = {
          accent: (settings as any).theme_accent || DEFAULT_THEME.accent,
          mode: (settings as any).theme_mode || DEFAULT_THEME.mode,
          radius: (settings as any).theme_radius || DEFAULT_THEME.radius,
          density: (settings as any).theme_density || DEFAULT_THEME.density,
          logoUrl: (settings as any).theme_logo_url || null,
        };
        setThemeState(loaded);
        setResolvedMode(resolveMode(loaded.mode));
        applyThemeToDOM(loaded);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        applyThemeToDOM(DEFAULT_THEME);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Listen for system preference changes in auto mode
  useEffect(() => {
    if (theme.mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = resolveMode(theme.mode);
      setResolvedMode(resolved);
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme.mode]);

  const setTheme = useCallback((patch: Partial<ThemeConfig>) => {
    setThemeState((prev) => {
      const next = { ...prev, ...patch };
      setResolvedMode(resolveMode(next.mode));
      applyThemeToDOM(next);
      return next;
    });
  }, []);

  const saveTheme = useCallback(async () => {
    // Read current state (it's latest on ref)
    await upsertCompanySettings({
      theme_accent: theme.accent,
      theme_mode: theme.mode,
      theme_radius: theme.radius,
      theme_density: theme.density,
      theme_logo_url: theme.logoUrl ?? undefined,
    } as any);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, saveTheme, loading, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
