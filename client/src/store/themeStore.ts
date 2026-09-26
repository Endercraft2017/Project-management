/**
 * Theme Store using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.classList.toggle('dark', systemTheme === 'dark');
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

// Initialize theme on load, and follow OS changes while on 'system'
if (typeof window !== 'undefined') {
  let theme: Theme = 'system';
  try {
    const stored = localStorage.getItem('theme-storage');
    if (stored) theme = JSON.parse(stored).state.theme;
  } catch {
    // Unreadable storage: keep the system default
  }
  applyTheme(theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system');
  });
}
