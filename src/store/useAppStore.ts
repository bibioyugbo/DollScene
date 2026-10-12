import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Appearance } from '../shared/types'

export type ThemeChoice = 'system' | 'light' | 'dark'

interface OnboardingDraft {
  starterId: string
  appearance: Appearance
  step: 'pick' | 'customize' | 'details'
  /** Set by the landing's quick-start panel: finish onboarding with this name and go straight to the crib. */
  quickName?: string
}

interface AppState {
  theme: ThemeChoice
  /** Unfinished onboarding, so a refresh does not lose the look. */
  onboarding: OnboardingDraft | null
  /** Show the optional clinic tab in the customizer. */
  showClinic: boolean
  setTheme: (theme: ThemeChoice) => void
  setOnboarding: (d: OnboardingDraft | null) => void
  setShowClinic: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      onboarding: null,
      showClinic: false,
      setTheme: (theme) => set({ theme }),
      setOnboarding: (onboarding) => set({ onboarding }),
      setShowClinic: (showClinic) => set({ showClinic }),
    }),
    {
      // Key kept from v1 so the saved theme survives the upgrade (index.html reads it pre-paint).
      name: 'dollscene-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return { theme: p.theme ?? 'system', onboarding: null, showClinic: false } as AppState
      },
      partialize: (s) => ({ theme: s.theme, onboarding: s.onboarding, showClinic: s.showClinic }),
    },
  ),
)
