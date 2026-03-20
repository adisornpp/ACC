import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'
import type { Account } from '../../types/accounting'

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Asset: 'สินทรัพย์',
  Liability: 'หนี้สิน',
  Equity: 'ทุน',
  Revenue: 'รายได้',
  Expense: 'ค่าใช้จ่าย',
}
const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Asset: 'bg-blue-100 text-blue-700',
  Liability: 'bg-red-100 text-red-700',
  Equity: 'bg-purple-100 text-purple-700',
  Revenue: 'bg-green-100 text-green-700',
  Expense: 'bg-orange-100 text-orange-700',
}

interface AccountFormData {
  accountCode: string
  accountName: string
  accountType: string
  subType: string
  balanceSide: 'D' | 'C'
  parentAccountId: string
}

const emptyForm: AccountFormData = {
  accountCode: '',
  accountName: '',
  accountType: 'Asset',
  subType: '',
  balanceSide: 'D',
  parentAccountId: '',
}

export default function ChartOfAccountsPage() {
  const { currentCompany } = useCompanyStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [form, setForm] = useState<AccountFormData>(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAccounts = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      const data = await invoke<Account[]>('get_accounts', { companyId: currentCompany.id })
      setAccounts(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [currentCompany])

  const handleSeedCOA = async () => {
    if (!currentCompany) return
    if (!confirm('จะเพิ่มแผนบัญชีมาตรฐานไทยให้บริษัทนี้ ต้องการดำเนินการต่อ?')) return
    setSeeding(true)
    try {
      const count = await invoke<number>('seed_thai_coa', { companyId: currentCompany.id })
      await loadAccounts()
      alert(`เพิ่มแผนบัญชีสำเร็จ ${count} รายการ`)
    } catch (e) {
      setError(String(e))
    } finally {
      setSeeding(false)
    }
  }

  const openCreate = () => {
    setEditAccount(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (account: Account) => {
    setEditAccount(account)
    setForm({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      subType: account.subType ?? '',
      balanceSide: account.balanceSide as 'D' | 'C',
      parentAccountId: account.parentAccountId ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!currentCompany) return
    if (!form.accountCode.trim() || !form.accountName.trim()) {
      setError('กรุณากรอกรหัสบัญชีและชื่อบัญชี')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editAccount) {
        await invoke('update_account', {
          id: editAccount.id,
          account: {
            accountCode: form.accountCode,
            accountName: form.accountName,
            accountType: form.accountType,
            subType: form.subType || null,
            balanceSide: form.balanceSide,
            isActive: true,
            parentAccountId: form.parentAccountId || null,
          },
        })
      } else {
        await invoke('create_account', {
          account: {
            companyId: currentCompany.id,
            accountCode: form.accountCode,
            accountName: form.accountName,
            accountType: form.accountType,
            subType: form.subType || null,
            balanceSide: form.balanceSide,
            parentAccountId: form.parentAccountId || null,
          },
        })
      }
      await loadAccounts()
      setShowForm(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (account: Account) => {
    if (!confirm(`ลบบัญชี "${account.accountCode} - ${account.accountName}"?`)) return
    try {
      await invoke('delete_account', { id: account.id })
      await loadAccounts()
    } catch (e) {
      alert(String(e))
    }
  }

  const filtered = accounts.filter(a => {
    const matchSearch = !search ||
      a.accountCode.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || a.accountType === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แผนบัญชี</h1>
          <p className="text-sm text-gray-500 mt-1">{currentCompany?.name} · {accounts.length} บัญชี</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <button
              onClick={handleSeedCOA}
              disabled={seeding}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-sm font-medium disabled:opacity-50"
            >
              {seeding ? 'กำลังเพิ่ม...' : '+ นำเข้าแผนบัญชีมาตรฐานไทย'}
            </button>
          )}
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            + เพิ่มบัญชี
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหารหัสหรือชื่อบัญชี..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">ทุกประเภท</option>
          {ACCOUNT_TYPES.map(t => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">ยังไม่มีแผนบัญชี</p>
            <p className="text-sm mt-2">คลิก "นำเข้าแผนบัญชีมาตรฐานไทย" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">รหัสบัญชี</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อบัญชี</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">ประเภท</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">ประเภทย่อย</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-16">ด้าน</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(account => (
                <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{account.accountCode}</td>
                  <td className="px-4 py-3 text-gray-900">{account.accountName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACCOUNT_TYPE_COLORS[account.accountType]}`}>
                      {ACCOUNT_TYPE_LABELS[account.accountType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{account.subType ?? '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono text-xs">
                    {account.balanceSide === 'D' ? 'เดบิต' : 'เครดิต'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(account)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editAccount ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีใหม่'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสบัญชี *</label>
                  <input
                    type="text"
                    value={form.accountCode}
                    onChange={e => setForm({ ...form, accountCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="เช่น 1100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทบัญชี *</label>
                  <select
                    value={form.accountType}
                    onChange={e => setForm({ ...form, accountType: e.target.value, balanceSide: e.target.value === 'Liability' || e.target.value === 'Equity' || e.target.value === 'Revenue' ? 'C' : 'D' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ACCOUNT_TYPES.map(t => (
                      <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี *</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={e => setForm({ ...form, accountName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="เช่น เงินสด"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทย่อย</label>
                  <input
                    type="text"
                    value={form.subType}
                    onChange={e => setForm({ ...form, subType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="เช่น Current Asset"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ด้านปกติ</label>
                  <select
                    value={form.balanceSide}
                    onChange={e => setForm({ ...form, balanceSide: e.target.value as 'D' | 'C' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="D">เดบิต (D)</option>
                    <option value="C">เครดิต (C)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
