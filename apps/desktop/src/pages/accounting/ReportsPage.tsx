import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'

function formatThb(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface TrialBalanceRow {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
}

interface BalanceSheetItem {
  accountCode: string
  accountName: string
  accountType: string
  subType: string
  balance: number
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Asset: 'สินทรัพย์', Liability: 'หนี้สิน', Equity: 'ทุน',
  Revenue: 'รายได้', Expense: 'ค่าใช้จ่าย',
}

type ReportTab = 'trial-balance' | 'balance-sheet' | 'income-statement'

export default function ReportsPage() {
  const { currentCompany } = useCompanyStore()
  const [tab, setTab] = useState<ReportTab>('trial-balance')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([])
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetItem[]>([])
  const [incomeStatement, setIncomeStatement] = useState<BalanceSheetItem[]>([])

  const loadReport = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      if (tab === 'trial-balance') {
        const data = await invoke<TrialBalanceRow[]>('get_trial_balance', {
          companyId: currentCompany.id, asOfDate,
        })
        setTrialBalance(data)
      } else if (tab === 'balance-sheet') {
        const data = await invoke<BalanceSheetItem[]>('get_balance_sheet', {
          companyId: currentCompany.id, asOfDate,
        })
        setBalanceSheet(data)
      } else {
        const data = await invoke<BalanceSheetItem[]>('get_income_statement', {
          companyId: currentCompany.id, fromDate, toDate,
        })
        setIncomeStatement(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Group balance sheet items
  const groupedBS = balanceSheet.reduce<Record<string, BalanceSheetItem[]>>((acc, item) => {
    const key = item.accountType
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const groupedIS = incomeStatement.reduce<Record<string, BalanceSheetItem[]>>((acc, item) => {
    const key = item.accountType
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const totalRevenue = (groupedIS['Revenue'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalExpense = (groupedIS['Expense'] ?? []).reduce((s, i) => s + i.balance, 0)
  const netIncome = totalRevenue - totalExpense

  const totalAssets = (groupedBS['Asset'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalLiabilities = (groupedBS['Liability'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalEquity = (groupedBS['Equity'] ?? []).reduce((s, i) => s + i.balance, 0)

  const tabClass = (t: ReportTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t
      ? 'bg-indigo-600 text-white'
      : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">รายงานการเงิน</h1>
        <p className="text-sm text-gray-500 mt-1">{currentCompany?.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('trial-balance')} className={tabClass('trial-balance')}>ดุลบัญชี</button>
        <button onClick={() => setTab('balance-sheet')} className={tabClass('balance-sheet')}>งบดุล</button>
        <button onClick={() => setTab('income-statement')} className={tabClass('income-statement')}>งบกำไรขาดทุน</button>
      </div>

      {/* Date Controls */}
      <div className="flex items-end gap-3">
        {tab === 'income-statement' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ณ วันที่</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'กำลังโหลด...' : 'สร้างรายงาน'}
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">

        {/* Trial Balance */}
        {tab === 'trial-balance' && (
          trialBalance.length === 0 ? (
            <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูดุลบัญชี</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">รหัสบัญชี</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อบัญชี</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">ประเภท</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">เดบิต</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">เครดิต</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map(row => (
                  <tr key={row.accountCode} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-gray-700">{row.accountCode}</td>
                    <td className="px-4 py-2.5 text-gray-800">{row.accountName}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{ACCOUNT_TYPE_LABELS[row.accountType]}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-700">{row.debit > 0 ? formatThb(row.debit) : ''}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-600">{row.credit > 0 ? formatThb(row.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-gray-700">รวม</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {formatThb(trialBalance.reduce((s, r) => s + r.debit, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {formatThb(trialBalance.reduce((s, r) => s + r.credit, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )
        )}

        {/* Balance Sheet */}
        {tab === 'balance-sheet' && (
          balanceSheet.length === 0 ? (
            <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูงบดุล</div>
          ) : (
            <div className="p-6 space-y-8">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
                <h3 className="text-lg font-semibold mt-1">งบดุล (Balance Sheet)</h3>
                <p className="text-gray-500 text-sm">ณ วันที่ {asOfDate}</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Left: Assets */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-3 text-base border-b pb-2">สินทรัพย์</h4>
                  {(groupedBS['Asset'] ?? []).map(item => (
                    <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                      <span className="text-gray-700">{item.accountCode} {item.accountName}</span>
                      <span className="font-mono text-gray-900 ml-4">{formatThb(item.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-2 font-bold border-t-2 border-gray-400">
                    <span>รวมสินทรัพย์</span>
                    <span className="font-mono">{formatThb(totalAssets)}</span>
                  </div>
                </div>

                {/* Right: Liabilities + Equity */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-3 text-base border-b pb-2">หนี้สินและทุน</h4>
                  {(groupedBS['Liability'] ?? []).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">หนี้สิน</p>
                      {(groupedBS['Liability'] ?? []).map(item => (
                        <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                          <span className="text-gray-700">{item.accountCode} {item.accountName}</span>
                          <span className="font-mono text-gray-900 ml-4">{formatThb(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1.5 text-sm font-semibold border-b border-gray-300">
                        <span>รวมหนี้สิน</span>
                        <span className="font-mono">{formatThb(totalLiabilities)}</span>
                      </div>
                    </>
                  )}
                  {(groupedBS['Equity'] ?? []).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-1">ทุน</p>
                      {(groupedBS['Equity'] ?? []).map(item => (
                        <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                          <span className="text-gray-700">{item.accountCode} {item.accountName}</span>
                          <span className="font-mono text-gray-900 ml-4">{formatThb(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1.5 text-sm font-semibold border-b border-gray-300">
                        <span>รวมทุน</span>
                        <span className="font-mono">{formatThb(totalEquity)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-2 mt-2 font-bold border-t-2 border-gray-400">
                    <span>รวมหนี้สินและทุน</span>
                    <span className="font-mono">{formatThb(totalLiabilities + totalEquity)}</span>
                  </div>
                </div>
              </div>

              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
                <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-4 py-3 text-sm">
                  ⚠️ งบดุลไม่สมดุล: สินทรัพย์ {formatThb(totalAssets)} ≠ หนี้สิน+ทุน {formatThb(totalLiabilities + totalEquity)}
                </div>
              )}
            </div>
          )
        )}

        {/* Income Statement */}
        {tab === 'income-statement' && (
          incomeStatement.length === 0 ? (
            <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูงบกำไรขาดทุน</div>
          ) : (
            <div className="p-6 space-y-6 max-w-2xl mx-auto">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
                <h3 className="text-lg font-semibold mt-1">งบกำไรขาดทุน</h3>
                <p className="text-gray-500 text-sm">{fromDate} ถึง {toDate}</p>
              </div>

              {/* Revenue */}
              <div>
                <h4 className="font-bold text-gray-900 mb-2 text-base">รายได้</h4>
                {(groupedIS['Revenue'] ?? []).map(item => (
                  <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                    <span className="text-gray-700">{item.accountCode} {item.accountName}</span>
                    <span className="font-mono text-green-700 ml-4">{formatThb(item.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t border-gray-300">
                  <span>รวมรายได้</span>
                  <span className="font-mono text-green-700">{formatThb(totalRevenue)}</span>
                </div>
              </div>

              {/* Expenses */}
              <div>
                <h4 className="font-bold text-gray-900 mb-2 text-base">ค่าใช้จ่าย</h4>
                {(groupedIS['Expense'] ?? []).map(item => (
                  <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                    <span className="text-gray-700">{item.accountCode} {item.accountName}</span>
                    <span className="font-mono text-red-600 ml-4">{formatThb(item.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t border-gray-300">
                  <span>รวมค่าใช้จ่าย</span>
                  <span className="font-mono text-red-600">{formatThb(totalExpense)}</span>
                </div>
              </div>

              {/* Net Income */}
              <div className={`flex justify-between py-4 px-4 rounded-lg font-bold text-lg border-2 ${netIncome >= 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                <span>{netIncome >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</span>
                <span className="font-mono">฿{formatThb(Math.abs(netIncome))}</span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
