import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'
import type { Account, GlEntry } from '@packages/types/accounting'

function formatThb(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GeneralLedgerPage() {
  const { currentCompany } = useCompanyStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-01-01`
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState<GlEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentCompany) return
    invoke<Account[]>('get_accounts', { companyId: currentCompany.id }).then(setAccounts).catch(console.error)
  }, [currentCompany])

  const loadLedger = async () => {
    if (!currentCompany || !selectedAccount) return
    setLoading(true)
    try {
      const data = await invoke<GlEntry[]>('get_gl_entries', {
        companyId: currentCompany.id,
        accountId: selectedAccount,
        fromDate,
        toDate,
      })
      setEntries(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLedger() }, [selectedAccount, fromDate, toDate, currentCompany])

  const totalDebit = entries.reduce((s, e) => s + e.debitAmount, 0)
  const totalCredit = entries.reduce((s, e) => s + e.creditAmount, 0)

  const selectedAccountObj = accounts.find(a => a.id === selectedAccount)
  const isDebitNormal = selectedAccountObj?.balanceSide === 'D'
  const balance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit

  // Running balance
  let running = 0
  const entriesWithRunning = entries.map(e => {
    running += isDebitNormal
      ? e.debitAmount - e.creditAmount
      : e.creditAmount - e.debitAmount
    return { ...e, runningBalance: running }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">บัญชีแยกประเภท (GL)</h1>
        <p className="text-sm text-gray-500 mt-1">{currentCompany?.name}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">บัญชี</label>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- เลือกบัญชี --</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.accountCode} - {a.accountName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Account Summary Card */}
      {selectedAccountObj && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-600 font-medium">{selectedAccountObj.accountCode}</p>
            <p className="text-xl font-bold text-indigo-900">{selectedAccountObj.accountName}</p>
            <p className="text-sm text-indigo-500">{selectedAccountObj.accountType} · {selectedAccountObj.subType}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-600">ยอดคงเหลือสุทธิ</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
              ฿{formatThb(Math.abs(balance))}
            </p>
            <p className="text-sm text-indigo-500">
              {balance >= 0 ? (isDebitNormal ? 'เดบิต' : 'เครดิต') : (isDebitNormal ? 'เครดิต' : 'เดบิต')}
            </p>
          </div>
        </div>
      )}

      {/* GL Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {!selectedAccount ? (
          <div className="text-center py-16 text-gray-400">
            <p>กรุณาเลือกบัญชีเพื่อดูรายการ</p>
          </div>
        ) : loading ? (
          <div className="text-center py-16 text-gray-500">กำลังโหลด...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>ไม่พบรายการในช่วงวันที่นี้</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">วันที่</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">คำอธิบาย</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เดบิต</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เครดิต</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">ยอดคงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {entriesWithRunning.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{entry.postingDate}</td>
                  <td className="px-4 py-3 text-gray-800">{entry.description ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {entry.debitAmount > 0 ? formatThb(entry.debitAmount) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {entry.creditAmount > 0 ? formatThb(entry.creditAmount) : ''}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${entry.runningBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    {formatThb(Math.abs(entry.runningBalance))}
                    <span className="text-xs ml-1 text-gray-400">
                      {entry.runningBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : (isDebitNormal ? 'Cr' : 'Dr')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                <td colSpan={2} className="px-4 py-3 text-gray-700">รวม</td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">{formatThb(totalDebit)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{formatThb(totalCredit)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{formatThb(Math.abs(balance))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
