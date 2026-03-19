import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCompanyStore } from '@/store/companyStore'

const menuItems = [
  { path: '/', label: 'แดชบอร์ด', icon: '📊' },
  { path: '/accounts', label: 'แผนบัญชี', icon: '📑' },
  { path: '/entries', label: 'บันทึกบัญชี', icon: '📝' },
  { path: '/ledger', label: 'บัญชีแยกประเภท', icon: '📖' },
  { path: '/reports', label: 'รายงาน', icon: '📈' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const { currentCompany, companies, selectCompany } = useCompanyStore()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      // Error handled in store
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600">โปรแกรมทำบัญชี</h1>
        </div>

        {/* Company Selector */}
        <div className="px-6 py-4 border-b border-gray-200">
          <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">
            บริษัท
          </label>
          <select
            value={currentCompany?.id || ''}
            onChange={(e) => selectCompany(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                location.pathname === item.path
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          <div className="text-sm">
            <p className="text-gray-600">ผู้ใช้</p>
            <p className="font-medium text-gray-900">{user?.fullName}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
