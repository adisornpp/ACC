import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'
import { useAuthStore } from '@/store/authStore'
import type { Account, JournalEntry } from '@packages/types/accounting'

interface Journal {
  id: string
  journalCode: string
  journalName: string
  journalType: string
}

interface EntryLine {
  accountId: string
  description: string
  debitAmount: string
  creditAmount: string
}

const emptyLine = (): EntryLine => ({
  accountId: '',
  description: '',
  debitAmount: '',
  creditAmount: '',
})

function formatThb(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function JournalEntryPage() {
  const { currentCompany } = useCompanyStore()
  const { user } = useAuthStore()

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [selectedJournal, setSelectedJournal] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<EntryLine[]>([emptyLine(), emptyLine()])

  const loadData = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      const [entryData, journalData, accountData] = await Promise.all([
        invoke<JournalEntry[]>('get_journal_entries', { companyId: currentCompany.id }),
        invoke<Journal[]>('get_journals', { companyId: currentCompany.id }),
        invoke<Account[]>('get_accounts', { companyId: currentCompany.id }),
      ])
      setEntries(entryData)
      setJournals(journalData)
      setAccounts(accountData)
      if (journalData.length > 0 && !selectedJournal) {
        setSelectedJournal(journalData[0].id)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [currentCompany])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const setLine = (i: number, field: keyof EntryLine, value: string) => {
    setLines(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Mutually exclusive: if entering debit, clear credit and vice versa
      if (field === 'debitAmount' && value) next[i].creditAmount = ''
      if (field === 'creditAmount' && value) next[i].debitAmount = ''
      return next
    })
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (i: number) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSave = async (postImmediately = false) => {
    if (!currentCompany || !user) return
    if (!selectedJournal) { setError('กรุณาเลือกสมุดรายวัน'); return }
    if (!isBalanced) { setError('ยอดเดบิตต้องเท่ากับยอดเครดิต'); return }

    const validLines = lines.filter(l => l.accountId && (parseFloat(l.debitAmount) > 0 || parseFloat(l.creditAmount) > 0))
    if (validLines.length < 2) { setError('ต้องมีรายการบัญชีอย่างน้อย 2 บรรทัด'); return }

    setSaving(true)
    setError('')
    try {
      const created = await invoke<JournalEntry>('create_journal_entry', {
        entry: {
          companyId: currentCompany.id,
          journalId: selectedJournal,
          entryDate,
          description: description || null,
          lines: validLines.map(l => ({
            accountId: l.accountId,
            description: l.description || null,
            debitAmount: parseFloat(l.debitAmount) || 0,
            creditAmount: parseFloat(l.creditAmount) || 0,
          })),
        },
        userId: user.id,
      })

      if (postImmediately) {
        await invoke('post_journal_entry', { id: created.id, userId: user.id })
      }

      await loadData()
      setShowForm(false)
      resetForm()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async (entryId: string) => {
    if (!user) return
    if (!confirm('ยืนยันการ Post บันทึกบัญชีนี้? ไม่สามารถแก้ไขได้หลัง Post')) return
    try {
      await invoke('post_journal_entry', { id: entryId, userId: user.id })
      await loadData()
    } catch (e) {
      alert(String(e))
    }
  }

  const resetForm = () => {
    setDescription('')
    setEntryDate(new Date().toISOString().split('T')[0])
    setLines([emptyLine(), emptyLine()])
    setError('')
  }

  const getAccountName = (id: string) => {
    const a = accounts.find(a => a.id === id)
    return a ? `${a.accountCode} - ${a.accountName}` : id
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Draft: 'bg-yellow-100 text-yellow-700',
      Posted: 'bg-green-100 text-green-700',
      Reversed: 'bg-gray-100 text-gray-500',
    }
    const label: Record<string, string> = { Draft: 'Draft', Posted: 'Posted', Reversed: 'ยกเลิก' }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? ''}`}>{label[status] ?? status}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บันทึกบัญชี</h1>
          <p className="text-sm text-gray-500 mt-1">{currentCompany?.name}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          + บันทึกบัญชีใหม่
        </button>
      </div>

      {/* Entry List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500">กำลังโหลด...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">ยังไม่มีบันทึกบัญชี</p>
            <p className="text-sm mt-2">คลิก "บันทึกบัญชีใหม่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">เลขที่</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">วันที่</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">คำอธิบาย</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เดบิต</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เครดิต</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">สถานะ</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{entry.entryNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.entryDate}</td>
                  <td className="px-4 py-3 text-gray-800">{entry.description ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">{formatThb(entry.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">{formatThb(entry.totalCredit)}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(entry.postingStatus)}</td>
                  <td className="px-4 py-3 text-right">
                    {entry.postingStatus === 'Draft' && (
                      <button
                        onClick={() => handlePost(entry.id)}
                        className="text-green-600 hover:text-green-800 text-xs font-medium"
                      >
                        Post
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Journal Entry Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกบัญชีใหม่</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สมุดรายวัน</label>
                  <select
                    value={selectedJournal}
                    onChange={e => setSelectedJournal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {journals.map(j => (
                      <option key={j.id} value={j.id}>{j.journalCode} - {j.journalName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="คำอธิบายรายการ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* GL Lines */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">บัญชี</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 w-40">คำอธิบาย</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 w-32">เดบิต</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 w-32">เครดิต</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <select
                            value={line.accountId}
                            onChange={e => setLine(i, 'accountId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">-- เลือกบัญชี --</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.accountCode} - {a.accountName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => setLine(i, 'description', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="คำอธิบาย"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.debitAmount}
                            onChange={e => setLine(i, 'debitAmount', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.creditAmount}
                            onChange={e => setLine(i, 'creditAmount', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => removeLine(i)}
                            className="text-gray-400 hover:text-red-500 text-xs"
                            disabled={lines.length <= 2}
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <td colSpan={2} className="px-3 py-2">
                        <button onClick={addLine} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                          + เพิ่มบรรทัด
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono">
                        {formatThb(totalDebit)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold font-mono ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                        {formatThb(totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!isBalanced && totalDebit > 0 && (
                <p className="text-red-600 text-sm">
                  ยอดไม่สมดุล: เดบิต {formatThb(totalDebit)} ≠ เครดิต {formatThb(totalCredit)}
                  (ผลต่าง {formatThb(Math.abs(totalDebit - totalCredit))})
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                ยกเลิก
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !isBalanced}
                  className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50"
                >
                  บันทึกเป็น Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !isBalanced}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกและ Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
