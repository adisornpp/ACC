import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/tauri'
import type { Company } from '../../types/accounting'

interface CompanyStore {
  companies: Company[]
  currentCompany: Company | null
  isLoading: boolean
  error: string | null

  loadCompanies: () => Promise<void>
  selectCompany: (companyId: string) => Promise<void>
  createCompany: (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Company>
  updateCompany: (id: string, company: Partial<Company>) => Promise<Company>
  deleteCompany: (id: string) => Promise<void>
  clearError: () => void
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: [],
  currentCompany: null,
  isLoading: false,
  error: null,

  loadCompanies: async () => {
    set({ isLoading: true, error: null })
    try {
      const companies = await invoke<Company[]>('get_companies')
      set({
        companies,
        isLoading: false,
      })
      // Auto-select first company
      if (companies.length > 0) {
        set({ currentCompany: companies[0] })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถโหลดบริษัทได้'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  selectCompany: async (companyId) => {
    const companies = get().companies
    const company = companies.find((c) => c.id === companyId)
    if (company) {
      set({ currentCompany: company })
    } else {
      throw new Error('ไม่พบบริษัทที่เลือก')
    }
  },

  createCompany: async (companyData) => {
    set({ isLoading: true, error: null })
    try {
      const newCompany = await invoke<Company>('create_company', {
        company: companyData,
      })
      set((state) => ({
        companies: [...state.companies, newCompany],
        isLoading: false,
      }))
      return newCompany
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างบริษัทได้'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  updateCompany: async (id, companyData) => {
    set({ isLoading: true, error: null })
    try {
      const updatedCompany = await invoke<Company>('update_company', {
        id,
        company: companyData,
      })
      set((state) => ({
        companies: state.companies.map((c) => (c.id === id ? updatedCompany : c)),
        currentCompany:
          state.currentCompany?.id === id
            ? updatedCompany
            : state.currentCompany,
        isLoading: false,
      }))
      return updatedCompany
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถอัปเดตบริษัทได้'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  deleteCompany: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('delete_company', { id })
      set((state) => ({
        companies: state.companies.filter((c) => c.id !== id),
        currentCompany:
          state.currentCompany?.id === id
            ? state.companies[0] || null
            : state.currentCompany,
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถลบบริษัทได้'
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
