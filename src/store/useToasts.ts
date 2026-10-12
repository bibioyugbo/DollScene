import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] })
    window.setTimeout(() => get().dismiss(id), t.tone === 'error' ? 5000 : 3200)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = {
  info: (text: string, action?: Toast['action']) => useToasts.getState().push({ text, tone: 'info', action }),
  success: (text: string, action?: Toast['action']) => useToasts.getState().push({ text, tone: 'success', action }),
  error: (text: string) => useToasts.getState().push({ text, tone: 'error' }),
}
