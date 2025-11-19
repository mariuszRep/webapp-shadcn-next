import { create } from 'zustand'

interface OnboardingState {
  // Form data
  organizationName: string
  workspaceName: string
  organizationId: string | null

  // Current step (0: Welcome, 1: Create Org, 2: Create Workspace)
  currentStep: number

  // Actions
  setOrganizationName: (name: string) => void
  setWorkspaceName: (name: string) => void
  setOrganizationId: (id: string) => void
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: number) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  // Initial state
  organizationName: '',
  workspaceName: '',
  organizationId: null,
  currentStep: 0,

  // Actions
  setOrganizationName: (name) => set({ organizationName: name }),
  setWorkspaceName: (name) => set({ workspaceName: name }),
  setOrganizationId: (id) => set({ organizationId: id }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 2) })),
  previousStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
  goToStep: (step) => set({ currentStep: step }),
  reset: () => set({
    organizationName: '',
    workspaceName: '',
    organizationId: null,
    currentStep: 0,
  }),
}))
