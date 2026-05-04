import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Non-sensitive UI preferences only; session-scoped (tab). */
export type UiTheme = 'light' | 'dark' | 'system';

export interface UiStateSlice {
  sidebarOpen: boolean;
  theme: UiTheme;
  lastRoute: string;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: UiTheme) => void;
  setLastRoute: (path: string) => void;
}

export const useUiStateStore = create<UiStateSlice>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'system',
      lastRoute: '',
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setTheme: (theme) => set({ theme }),
      setLastRoute: (lastRoute) => set({ lastRoute }),
    }),
    {
      name: 'ui-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
