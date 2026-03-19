import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/tauri'
import type { User } from '../../types/accounting'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string, companyId: string) => Promise<void>
  logout: () => Promise<void>
  initAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password, companyId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await invoke<User>('login', {
        email,
        password,
        companyId,
      })
      set({
        user: response,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการล็อกอิน'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await invoke('logout')
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการออกจากระบบ'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  initAuth: async () => {
    set({ isLoading: true })
    try {
      const response = await invoke<User | null>('get_current_user')
      if (response) {
        set({
          user: response,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        set({
          isAuthenticated: false,
          isLoading: false,
        })
      }
    } catch (error) {
      set({
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
