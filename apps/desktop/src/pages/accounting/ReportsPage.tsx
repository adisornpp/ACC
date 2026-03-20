import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { save as saveDialog } from '@tauri-apps/api/dialog'
import { useCompanyStore } from '@/store/companyStore'
import { useToast } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'

function formatThb(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface TrialBalanceRow {
  accountCode: string; accountName: string; accountType: string
  debit: number; credit: number
}
interface BalanceSheetItem {
  accountCode: string; accountName: string; accountType: string
  subType: string; balance: number
}
interface VatReportRow {
  accountCode: string; accountName: string; vatType: string; amount: number
}
interface VatSummary {
  year: number; month: number
  inputVat: number; outputVat: number; netVat: number
  rows: VatReportRow[]
}

const TYPE_LABELS: Record<string, string> = {
  Asset: 'สินทรัพย์', Liability: 'หนี้สิน', Equity: 'ทุน',
  Revenue: 'รายได้', Expense: 'ค่าใช้จ่าย',
}
const MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
]

type ReportTab = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'vat'

export default function ReportsPage() {
  const { currentCompany } = useCompanyStore()
  const { toast } = useToast()
  const [tab, setTab] = useState<ReportTab>('trial-balance')
  const today = new Date()
  const [asOfDate, setAsOfDate] = useState(today.toISOString().split('T')[0])
  const [fromDate, setFromDate] = useState(`${today.getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0])
  const [vatYear, setVatYear] = useState(today.getFullYear())
  const [vatMonth, setVatMonth] = useState(today.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([])
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetItem[]>([])
  const [incomeStatement, setIncomeStatement] = useState<BalanceSheetItem[]>([])
  const [vatSummary, setVatSummary] = useState<VatSummary | null>(null)

  const loadReport = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      if (tab === 'trial-balance') {
        const data = await invoke<TrialBalanceRow[]>('get_trial_balance', { companyId: currentCompany.id, asOfDate })
        setTrialBalance(data)
      } else if (tab === 'balance-sheet') {
        const data = await invoke<BalanceSheetItem[]>('get_balance_sheet', { companyId: currentCompany.id, asOfDate })
        setBalanceSheet(data)
      } else if (tab === 'income-statement') {
        const data = await invoke<BalanceSheetItem[]>('get_income_statement', { companyId: currentCompany.id, fromDate, toDate })
        setIncomeStatement(data)
      } else {
        const data = await invoke<VatSummary>('get_vat_report', { companyId: currentCompany.id, year: vatYear, month: vatMonth })
        setVatSummary(data)
      }
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (!currentCompany) return
    const path = await saveDialog({
      defaultPath: `รายงาน_${currentCompany.name}_${tab}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (!path) return
    setExporting(true)
    try {
      if (tab === 'trial-balance') {
        await invoke('export_trial_balance_excel', {
          companyId: currentCompany.id,
          companyName: currentCompany.name,
          asOfDate,
          savePath: path,
        })
      } else if (tab === 'income-statement') {
        await invoke('export_income_statement_excel', {
          companyId: currentCompany.id,
          companyName: currentCompany.name,
          fromDate,
          toDate,
          savePath: path,
        })
      }
      toast('บันทึกไฟล์ Excel เรียบร้อย', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => window.print()

  // Groupings
  const groupBS = (data: BalanceSheetItem[]) =>
    data.reduce<Record<string, BalanceSheetItem[]>>((acc, item) => {
      ;(acc[item.accountType] ??= []).push(item)
      return acc
    }, {})

  const groupedBS = groupBS(balanceSheet)
  const groupedIS = groupBS(incomeStatement)
  const totalRevenue = (groupedIS['Revenue'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalExpense = (groupedIS['Expense'] ?? []).reduce((s, i) => s + i.balance, 0)
  const netIncome = totalRevenue - totalExpense
  const totalAssets = (groupedBS['Asset'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalLiabilities = (groupedBS['Liability'] ?? []).reduce((s, i) => s + i.balance, 0)
  const totalEquity = (groupedBS['Equity'] ?? []).reduce((s, i) => s + i.balance, 0)

  const tabClass = (t: ReportTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t
      ? 'bg-indigo-600 text-white'
      : 'text-gray-600 hover:bg-gray-100'}`

  const canExportExcel = tab === 'trial-balance' || tab === 'income-statement'

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="print:hidden flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายงานการเงิน</h1>
          <p className="text-sm text-gray-500 mt-1">{currentCompany?.name}</p>
        </div>
        <div className="flex gap-2">
          {canExportExcel && (
            <Button variant="secondary" size="sm" loading={exporting} onClick={handleExportExcel}>
              📊 Excel
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handlePrint}>🖨️ พิมพ์ / PDF</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="print:hidden flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('trial-balance')} className={tabClass('trial-balance')}>ดุลบัญชี</button>
        <button onClick={() => setTab('balance-sheet')} className={tabClass('balance-sheet')}>งบดุล</button>
        <button onClick={() => setTab('income-statement')} className={tabClass('income-statement')}>งบกำไรขาดทุน</button>
        <button onClick={() => setTab('vat')} className={tabClass('vat')}>รายงาน VAT</button>
      </div>

      {/* Date Controls */}
      <div className="print:hidden flex items-end gap-3 flex-wrap">
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
        ) : tab === 'vat' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ปี (ค.ศ.)</label>
              <input type="number" value={vatYear} onChange={e => setVatYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
              <select value={vatMonth} onChange={e => setVatMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ณ วันที่</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        <Button onClick={loadReport} loading={loading}>สร้างรายงาน</Button>
      </div>

      {/* Report content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">

        {/* Trial Balance */}
        {tab === 'trial-balance' && (
          trialBalance.length === 0
            ? <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูดุลบัญชี</div>
            : (
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
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{TYPE_LABELS[row.accountType]}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-700">{row.debit > 0 ? formatThb(row.debit) : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-600">{row.credit > 0 ? formatThb(row.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-gray-700">รวม</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{formatThb(trialBalance.reduce((s, r) => s + r.debit, 0))}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">{formatThb(trialBalance.reduce((s, r) => s + r.credit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )
        )}

        {/* Balance Sheet */}
        {tab === 'balance-sheet' && (
          balanceSheet.length === 0
            ? <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูงบดุล</div>
            : (
              <div className="p-6 space-y-8">
                <div className="text-center border-b pb-4">
                  <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
                  <h3 className="text-lg font-semibold mt-1">งบดุล (Balance Sheet)</h3>
                  <p className="text-gray-500 text-sm">ณ วันที่ {asOfDate}</p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 border-b pb-2">สินทรัพย์</h4>
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
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 border-b pb-2">หนี้สินและทุน</h4>
                    {(groupedBS['Liability'] ?? []).length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">หนี้สิน</p>
                        {(groupedBS['Liability'] ?? []).map(item => (
                          <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                            <span>{item.accountCode} {item.accountName}</span>
                            <span className="font-mono ml-4">{formatThb(item.balance)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1.5 text-sm font-semibold border-b border-gray-300">
                          <span>รวมหนี้สิน</span><span className="font-mono">{formatThb(totalLiabilities)}</span>
                        </div>
                      </>
                    )}
                    {(groupedBS['Equity'] ?? []).length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-1">ทุน</p>
                        {(groupedBS['Equity'] ?? []).map(item => (
                          <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                            <span>{item.accountCode} {item.accountName}</span>
                            <span className="font-mono ml-4">{formatThb(item.balance)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1.5 text-sm font-semibold border-b border-gray-300">
                          <span>รวมทุน</span><span className="font-mono">{formatThb(totalEquity)}</span>
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
          incomeStatement.length === 0
            ? <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูงบกำไรขาดทุน</div>
            : (
              <div className="p-6 space-y-6 max-w-2xl mx-auto">
                <div className="text-center border-b pb-4">
                  <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
                  <h3 className="text-lg font-semibold mt-1">งบกำไรขาดทุน</h3>
                  <p className="text-gray-500 text-sm">{fromDate} ถึง {toDate}</p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">รายได้</h4>
                  {(groupedIS['Revenue'] ?? []).map(item => (
                    <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                      <span>{item.accountCode} {item.accountName}</span>
                      <span className="font-mono text-green-700 ml-4">{formatThb(item.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold border-t border-gray-300">
                    <span>รวมรายได้</span><span className="font-mono text-green-700">{formatThb(totalRevenue)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">ค่าใช้จ่าย</h4>
                  {(groupedIS['Expense'] ?? []).map(item => (
                    <div key={item.accountCode} className="flex justify-between py-1.5 text-sm border-b border-gray-100">
                      <span>{item.accountCode} {item.accountName}</span>
                      <span className="font-mono text-red-600 ml-4">{formatThb(item.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold border-t border-gray-300">
                    <span>รวมค่าใช้จ่าย</span><span className="font-mono text-red-600">{formatThb(totalExpense)}</span>
                  </div>
                </div>
                <div className={`flex justify-between py-4 px-4 rounded-lg font-bold text-lg border-2 ${netIncome >= 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                  <span>{netIncome >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</span>
                  <span className="font-mono">฿{formatThb(Math.abs(netIncome))}</span>
                </div>
              </div>
            )
        )}

        {/* VAT Report */}
        {tab === 'vat' && (
          !vatSummary
            ? <div className="text-center py-16 text-gray-400">คลิก "สร้างรายงาน" เพื่อดูรายงาน VAT</div>
            : (
              <div className="p-6 space-y-6 max-w-2xl mx-auto">
                <div className="text-center border-b pb-4">
                  <h2 className="text-xl font-bold">{currentCompany?.name}</h2>
                  <h3 className="text-lg font-semibold mt-1">รายงานภาษีมูลค่าเพิ่ม (VAT)</h3>
                  <p className="text-gray-500 text-sm">เดือน {MONTHS[vatSummary.month - 1]} {vatSummary.year + 543}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-blue-600 font-medium mb-1">ภาษีซื้อ (Input VAT)</p>
                    <p className="text-xl font-bold text-blue-700">฿{formatThb(vatSummary.inputVat)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-600 font-medium mb-1">ภาษีขาย (Output VAT)</p>
                    <p className="text-xl font-bold text-orange-700">฿{formatThb(vatSummary.outputVat)}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center ${vatSummary.netVat >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`text-xs font-medium mb-1 ${vatSummary.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {vatSummary.netVat >= 0 ? 'VAT ที่ต้องชำระ' : 'VAT ที่ขอคืนได้'}
                    </p>
                    <p className={`text-xl font-bold ${vatSummary.netVat >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      ฿{formatThb(Math.abs(vatSummary.netVat))}
                    </p>
                  </div>
                </div>

                {vatSummary.rows.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">รหัสบัญชี</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อบัญชี</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">ประเภท</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vatSummary.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-gray-700">{row.accountCode}</td>
                          <td className="px-4 py-2.5 text-gray-800">{row.accountName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.vatType === 'Input' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {row.vatType === 'Input' ? 'ภาษีซื้อ' : 'ภาษีขาย'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-900">{formatThb(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    ไม่พบรายการ VAT ในเดือนนี้ (ต้องมีบัญชีที่มีชื่อ "VAT" หรือ "ภาษีมูลค่าเพิ่ม" หรือรหัส 1151/2151)
                  </div>
                )}
              </div>
            )
        )}
      </div>
    </div>
  )
}
