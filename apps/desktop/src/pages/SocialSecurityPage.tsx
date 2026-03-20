import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { save as saveDialog } from '@tauri-apps/api/dialog'
import { useCompanyStore } from '@/store/companyStore'
import { useToast } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'

function formatThb(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Employee {
  id: string
  companyId: string
  employeeCode: string
  fullName: string
  ssNumber?: string
  salary: number
  isActive: boolean
  createdAt: string
}

interface SsContributionRow {
  employeeId: string
  employeeCode: string
  fullName: string
  salary: number
  employeeContribution: number
  employerContribution: number
  totalContribution: number
}

interface SsSummary {
  year: number
  month: number
  employeeCount: number
  totalSalary: number
  totalEmployeeContribution: number
  totalEmployerContribution: number
  totalContribution: number
  rows: SsContributionRow[]
}

interface EmployeeForm {
  employeeCode: string
  fullName: string
  ssNumber: string
  salary: string
}

const MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
]

const EMPTY_FORM: EmployeeForm = { employeeCode: '', fullName: '', ssNumber: '', salary: '' }

export default function SocialSecurityPage() {
  const { currentCompany } = useCompanyStore()
  const { toast } = useToast()

  const today = new Date()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [summary, setSummary] = useState<SsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [ssYear, setSsYear] = useState(today.getFullYear())
  const [ssMonth, setSsMonth] = useState(today.getMonth() + 1)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM)

  const loadEmployees = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      const data = await invoke<Employee[]>('get_employees', { companyId: currentCompany.id })
      setEmployees(data)
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [currentCompany?.id])

  const handleCalculate = async () => {
    if (!currentCompany) return
    setLoading(true)
    try {
      const data = await invoke<SsSummary>('calculate_ss_report', {
        companyId: currentCompany.id,
        year: ssYear,
        month: ssMonth,
      })
      setSummary(data)
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (!currentCompany || !summary) return
    const path = await saveDialog({
      defaultPath: `ประกันสังคม_${currentCompany.name}_${MONTHS[ssMonth - 1]}_${ssYear + 543}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (!path) return
    setExporting(true)
    try {
      await invoke('export_ss_excel', {
        companyId: currentCompany.id,
        companyName: currentCompany.name,
        year: ssYear,
        month: ssMonth,
        savePath: path,
      })
      toast('บันทึกไฟล์ Excel เรียบร้อย', 'success')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  const openAdd = () => { setForm(EMPTY_FORM); setShowAddModal(true) }
  const openEdit = (emp: Employee) => {
    setForm({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      ssNumber: emp.ssNumber ?? '',
      salary: String(emp.salary),
    })
    setEditTarget(emp)
  }
  const closeModals = () => { setShowAddModal(false); setEditTarget(null); setDeleteTarget(null) }

  const handleSave = async () => {
    if (!currentCompany) return
    if (!form.fullName.trim()) { toast('กรุณากรอกชื่อพนักงาน', 'error'); return }
    const salary = parseFloat(form.salary)
    if (isNaN(salary) || salary <= 0) { toast('กรุณากรอกเงินเดือนที่ถูกต้อง', 'error'); return }

    setSaving(true)
    try {
      if (editTarget) {
        await invoke('update_employee', {
          id: editTarget.id,
          fullName: form.fullName,
          ssNumber: form.ssNumber || null,
          salary,
        })
        toast('อัปเดตข้อมูลพนักงานเรียบร้อย', 'success')
      } else {
        if (!form.employeeCode.trim()) { toast('กรุณากรอกรหัสพนักงาน', 'error'); setSaving(false); return }
        await invoke('create_employee', {
          input: {
            companyId: currentCompany.id,
            employeeCode: form.employeeCode,
            fullName: form.fullName,
            ssNumber: form.ssNumber || null,
            salary,
          },
        })
        toast('เพิ่มพนักงานเรียบร้อย', 'success')
      }
      await loadEmployees()
      closeModals()
    } catch (e: any) {
      toast(e?.message ?? String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await invoke('delete_employee', { id: deleteTarget.id })
      await loadEmployees()
      toast('ลบพนักงานเรียบร้อย', 'success')
      closeModals()
    } catch (e: any) {
      toast(e?.message ?? String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const EmployeeForm = (
    <div className="space-y-4">
      {!editTarget && (
        <Input
          label="รหัสพนักงาน *"
          value={form.employeeCode}
          onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))}
          placeholder="001"
        />
      )}
      <Input
        label="ชื่อ-สกุล *"
        value={form.fullName}
        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
        placeholder="นาย ทดสอบ ระบบ"
      />
      <Input
        label="เลขประกันสังคม (13 หลัก)"
        value={form.ssNumber}
        onChange={e => setForm(f => ({ ...f, ssNumber: e.target.value }))}
        placeholder="0000000000000"
        maxLength={13}
      />
      <Input
        label="เงินเดือน (บาท) *"
        type="number"
        value={form.salary}
        onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
        placeholder="15000"
        min={0}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ประกันสังคม</h1>
          <p className="text-sm text-gray-500 mt-1">
            {employees.length} พนักงาน · อัตรา 5% (สูงสุด ฿750/คน/เดือน)
          </p>
        </div>
        <Button onClick={openAdd}>+ เพิ่มพนักงาน</Button>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">รายชื่อพนักงาน</h2>
        </div>
        {employees.length === 0 ? (
          <EmptyState
            icon="👷"
            title="ยังไม่มีพนักงาน"
            description="เพิ่มพนักงานเพื่อคำนวณเงินสมทบประกันสังคม"
            action={<Button size="sm" onClick={openAdd}>+ เพิ่มพนักงาน</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">รหัส</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">เลขประกันสังคม</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เงินเดือน</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-28">SS/เดือน</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const base = Math.min(emp.salary, 15000)
                const ss = Math.max(Math.min(base * 0.05, 750), 83)
                return (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{emp.employeeCode}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{emp.fullName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{emp.ssNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">฿{formatThb(emp.salary)}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-600">฿{formatThb(ss)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>แก้ไข</Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(emp)}>ลบ</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SS Calculation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900">คำนวณเงินสมทบประกันสังคม</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">ปี (ค.ศ.)</label>
              <input
                type="number"
                value={ssYear}
                onChange={e => setSsYear(Number(e.target.value))}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">เดือน</label>
              <select
                value={ssMonth}
                onChange={e => setSsMonth(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <Button size="sm" onClick={handleCalculate} loading={loading}>คำนวณ</Button>
            {summary && (
              <Button size="sm" variant="secondary" onClick={handleExportExcel} loading={exporting}>
                📊 Excel
              </Button>
            )}
          </div>
        </div>

        {!summary ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            เลือกเดือน แล้วกด "คำนวณ" เพื่อดูยอดประกันสังคม
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <p className="text-xs text-indigo-600 mb-1">พนักงาน</p>
                <p className="text-2xl font-bold text-indigo-700">{summary.employeeCount} คน</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-600 mb-1">รวมเงินเดือน</p>
                <p className="text-lg font-bold text-gray-700">฿{formatThb(summary.totalSalary)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-xs text-blue-600 mb-1">ส่วนลูกจ้าง</p>
                <p className="text-lg font-bold text-blue-700">฿{formatThb(summary.totalEmployeeContribution)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-xs text-orange-600 mb-1">ส่วนนายจ้าง</p>
                <p className="text-lg font-bold text-orange-700">฿{formatThb(summary.totalEmployerContribution)}</p>
              </div>
            </div>

            <div className="flex justify-between items-center px-4 py-3 bg-indigo-600 rounded-xl text-white font-bold">
              <span>รวมนำส่งประกันสังคม (เดือน{MONTHS[summary.month - 1]} {summary.year + 543})</span>
              <span className="text-xl font-mono">฿{formatThb(summary.totalContribution)}</span>
            </div>

            {/* Detail Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-16">ลำดับ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">รหัส</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ-สกุล</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">เงินเดือน</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-28">ส่วนลูกจ้าง</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-28">ส่วนนายจ้าง</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row, i) => (
                  <tr key={row.employeeId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600">{row.employeeCode}</td>
                    <td className="px-4 py-2.5 text-gray-800">{row.fullName}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">฿{formatThb(row.salary)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-700">฿{formatThb(row.employeeContribution)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-orange-600">฿{formatThb(row.employerContribution)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                  <td colSpan={3} className="px-4 py-3">รวม</td>
                  <td className="px-4 py-3 text-right font-mono">฿{formatThb(summary.totalSalary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">฿{formatThb(summary.totalEmployeeContribution)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">฿{formatThb(summary.totalEmployerContribution)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        open={showAddModal}
        onClose={closeModals}
        title="เพิ่มพนักงาน"
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button loading={saving} onClick={handleSave}>บันทึก</Button>
          </>
        }
      >
        {EmployeeForm}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTarget}
        onClose={closeModals}
        title={`แก้ไข: ${editTarget?.fullName}`}
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button loading={saving} onClick={handleSave}>บันทึก</Button>
          </>
        }
      >
        {EmployeeForm}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={closeModals}
        title="ยืนยันการลบพนักงาน"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button variant="danger" loading={saving} onClick={handleDelete}>ลบ</Button>
          </>
        }
      >
        <p className="text-gray-700">ลบ <strong>{deleteTarget?.fullName}</strong> ออกจากระบบ?</p>
      </Modal>
    </div>
  )
}
