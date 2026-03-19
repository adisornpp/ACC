import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCompanyStore } from '@/store/companyStore'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CompaniesPage from '@/pages/CompaniesPage'
import ChartOfAccountsPage from '@/pages/accounting/ChartOfAccountsPage'
import JournalEntryPage from '@/pages/accounting/JournalEntryPage'
import GeneralLedgerPage from '@/pages/accounting/GeneralLedgerPage'
import ReportsPage from '@/pages/accounting/ReportsPage'

// Components
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/toaster'

function App() {
  const { isAuthenticated, user, initAuth } = useAuthStore()
  const { loadCompanies } = useCompanyStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        await initAuth()
        await loadCompanies()
      } catch (error) {
        console.error('Failed to initialize app:', error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [initAuth, loadCompanies])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">โปรแกรมทำบัญชี</h1>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <Toaster>
      <Router>
        <Routes>
          {!isAuthenticated ? (
            <Route path="/login" element={<LoginPage />} />
          ) : (
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/accounts" element={<ChartOfAccountsPage />} />
              <Route path="/entries" element={<JournalEntryPage />} />
              <Route path="/ledger" element={<GeneralLedgerPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
          )}
          <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
        </Routes>
      </Router>
    </Toaster>
  )
}

export default App
