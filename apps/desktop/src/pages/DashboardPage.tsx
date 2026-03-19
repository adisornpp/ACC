import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '@/store/companyStore'
import { useAuthStore } from '@/store/authStore'
import type { JournalEntry } from '../types/accounting'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: string
  color: string
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function formatThb(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_BADGE: Record<string, string> = {
  Draft:    'bg-yellow-100 text-yellow-700',
  Posted:   'bg-green-100 text-green-700',
  Reversed: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = { Draft: 'Draft', Posted: 'Posted', Reversed: 'ยกเลิก' }

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentCompany, companies } = useCompanyStore()
  const { user } = useAuthStore()
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([])
  const [stats, setStats] = useState({ postedCount: 0, draftCount: 0, totalDebit: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentCompany) return
    setLoading(true)
    invoke<JournalEntry[]>('get_journal_entries', { companyId: currentCompany.id })
      .then(entries => {
        setRecentEntries(entries.slice(0, 8))
        const posted = entries.filter(e => e.postingStatus === 'Posted')
        setStats({
          postedCount: posted.length,
          draftCount:  entries.filter(e => e.postingStatus === 'Draft').length,
          totalDebit:  posted.reduce((s, e) => s + e.totalDebit, 0),
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentCompany])

  const today = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-400">{today}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          สวัสดี, {user?.fullName?.split(' ')[0] ?? 'ผู้ใช้'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">{currentCompany?.name ?? 'กรุณาเลือกบริษัท'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="รายการที่ Post แล้ว" value={stats.postedCount}     sub="รายการบัญชี"        icon="✅" color="bg-green-50"  />
        <StatCard label="รายการ Draft"         value={stats.draftCount}      sub="รอ Post"            icon="📝" color="bg-yellow-50" />
        <StatCard label="ยอดเดบิตรวม"          value={formatThb(stats.totalDebit)} sub="รายการที่ Post" icon="📈" color="bg-blue-50"   />
        <StatCard label="จำนวนบริษัท"          value={companies.length}      sub="ที่ดูแลอยู่"        icon="🏢" color="bg-purple-50" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">ทางลัด</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'บันทึกบัญชีใหม่', icon: '➕', path: '/entries',  color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' },
            { label: 'แผนบัญชี',         icon: '📑', path: '/accounts', color: 'bg-blue-50   hover:bg-blue-100   text-blue-700   border-blue-200'   },
            { label: 'บัญชีแยกประเภท',   icon: '📖', path: '/ledger',   color: 'bg-teal-50   hover:bg-teal-100   text-teal-700   border-teal-200'   },
            { label: 'ออกรายงาน',         icon: '📊', path: '/reports',  color: 'bg-green-50  hover:bg-green-100  text-green-700  border-green-200'  },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border text-sm font-medium transition-colors ${item.color}`}
            >
              <span className="text-3xl">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">รายการบัญชีล่าสุด</h2>
          <button onClick={() => navigate('/entries')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            ดูทั้งหมด →
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">กำลังโหลด...</div>
          ) : recentEntries.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-gray-400">ยังไม่มีรายการบัญชี</p>
              <button onClick={() => navigate('/entries')} className="text-sm text-indigo-600 hover:underline">
                เริ่มบันทึกรายการแรก →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">เลขที่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">วันที่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">คำอธิบาย</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">จำนวน</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{entry.entryNumber}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{entry.entryDate}</td>
                    <td className="px-4 py-3 text-gray-800">{entry.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatThb(entry.totalDebit)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[entry.postingStatus] ?? ''}`}>
                        {STATUS_LABEL[entry.postingStatus] ?? entry.postingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
