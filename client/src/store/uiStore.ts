/**
 * UI Preferences Store
 * Per-browser layout preferences for the app shell.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  sidebarCollapsed: boolean;
  ambientMotion: boolean;
  toggleSidebar: () => void;
  setAmbientMotion: (enabled: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      ambientMotion: true,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setAmbientMotion: (enabled) => set({ ambientMotion: enabled }),
    }),
    {
      name: 'ui-preferences',
    }
  )
);
