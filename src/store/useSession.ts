import { create } from 'zustand'
import type { AuthUser } from '../services/types'
import type { ApartmentDoc, DollDoc, InventoryDoc, OutfitsDoc, ProgressDoc, PublicDoll, UserDoc } from '../shared/types'

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in'

/** Live mirror of the signed-in player's own documents. Filled by <SessionProvider>. */
export interface SessionState {
  status: SessionStatus
  user: AuthUser | null
  /** True once users/{uid} has been read at least once. */
  profileLoaded: boolean
  profile: UserDoc | null
  doll: DollDoc | null
  publicDoll: PublicDoll | null
  progress: ProgressDoc | null
  inventory: InventoryDoc | null
  apartment: ApartmentDoc | null
  outfits: OutfitsDoc | null
  friendUids: string[]
  blockedUids: string[]
  unreadNotifications: number
  unreadMessages: number
  pendingRequests: number
  /** Set while the auth modal creates the account, so the age gate does not flash. */
  bootstrapping: boolean
  set: (patch: Partial<SessionState>) => void
  reset: () => void
}

const empty = {
  user: null,
  profileLoaded: false,
  profile: null,
  doll: null,
  publicDoll: null,
  progress: null,
  inventory: null,
  apartment: null,
  outfits: null,
  friendUids: [],
  blockedUids: [],
  unreadNotifications: 0,
  unreadMessages: 0,
  pendingRequests: 0,
  bootstrapping: false,
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  ...empty,
  set: (patch) => set(patch),
  reset: () => set({ status: 'signed-out', ...empty }),
}))

export const useUid = () => useSession((s) => s.user?.uid ?? null)
