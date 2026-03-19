import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'
import { useToast } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import type { Company } from '../types/accounting'

interface CompanyFormData {
  name: string
  taxId: string
  address: string
  phone: string
  email: string
  currency: string
  fiscalYearStart: number
  isVatRegistered: boolean
}

const EMPTY_FORM: CompanyFormData = {
  name: '',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  currency: 'THB',
  fiscalYearStart: 1,
  isVatRegistered: false,
}

const MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
]

function CompanyCard({
  company,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onSeedCoa,
}: {
  company: Company
  isActive: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onSeedCoa: () => void
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-all ${
        isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
            🏢
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
            {company.taxId && (
              <p className="text-xs text-gray-400 mt-0.5">เลขผู้เสียภาษี: {company.taxId}</p>
            )}
          </div>
        </div>
        {isActive && (
          <span className="flex-shrink-0 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            ใช้งานอยู่
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-gray-500">
        {company.address && <p className="truncate">📍 {company.address}</p>}
        {company.phone   && <p>📞 {company.phone}</p>}
        {company.email   && <p>✉️ {company.email}</p>}
        <p>📅 ปีงบประมาณเริ่ม: {MONTHS[(company.fiscalYearStart ?? 1) - 1]}</p>
        {company.isVatRegistered && <p>🧾 จดทะเบียนภาษีมูลค่าเพิ่ม</p>}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
        {!isActive && (
          <Button size="sm" onClick={onSelect}>เลือก</Button>
        )}
        <Button size="sm" variant="secondary" onClick={onSeedCoa}>นำเข้า COA</Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>แก้ไข</Button>
        <Button size="sm" variant="danger" onClick={onDelete}>ลบ</Button>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const { companies, currentCompany, loadCompanies, selectCompany, createCompany, updateCompany, deleteCompany } = useCompanyStore()
  const { toast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [form, setForm] = useState<CompanyFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState<number | null>(null)

  function openCreate() {
    setForm(EMPTY_FORM)
    setShowCreate(true)
  }

  function openEdit(company: Company) {
    setForm({
      name:             company.name,
      taxId:            company.taxId ?? '',
      address:          company.address ?? '',
      phone:            company.phone ?? '',
      email:            company.email ?? '',
      currency:         company.currency ?? 'THB',
      fiscalYearStart:  company.fiscalYearStart ?? 1,
      isVatRegistered:  company.isVatRegistered ?? false,
    })
    setEditTarget(company)
  }

  function closeModals() {
    setShowCreate(false)
    setEditTarget(null)
    setDeleteTarget(null)
  }

  function setField<K extends keyof CompanyFormData>(key: K, value: CompanyFormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('กรุณากรอกชื่อบริษัท', 'error'); return }
    setSaving(true)
    try {
      if (editTarget) {
        await updateCompany(editTarget.id, form)
        toast('อัปเดตข้อมูลบริษัทเรียบร้อย', 'success')
      } else {
        await createCompany(form)
        toast('สร้างบริษัทใหม่เรียบร้อย', 'success')
      }
      closeModals()
    } catch (e: any) {
      toast(e?.message ?? 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteCompany(deleteTarget.id)
      toast('ลบบริษัทเรียบร้อย', 'success')
      closeModals()
    } catch (e: any) {
      toast(e?.message ?? 'ไม่สามารถลบได้', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSeedCoa(company: Company) {
    setSeeding(company.id)
    try {
      const count = await invoke<number>('seed_thai_coa', { companyId: company.id })
      if (count > 0) {
        toast(`นำเข้าแผนบัญชีมาตรฐาน ${count} รายการ`, 'success')
      } else {
        toast('มีแผนบัญชีอยู่แล้ว ไม่มีรายการใหม่', 'info')
      }
    } catch (e: any) {
      toast(e?.message ?? 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSeeding(null)
    }
  }

  const CompanyForm = (
    <div className="space-y-4">
      <Input
        label="ชื่อบริษัท *"
        value={form.name}
        onChange={e => setField('name', e.target.value)}
        placeholder="บริษัท ตัวอย่าง จำกัด"
      />
      <Input
        label="เลขประจำตัวผู้เสียภาษี"
        value={form.taxId}
        onChange={e => setField('taxId', e.target.value)}
        placeholder="0000000000000"
        maxLength={13}
      />
      <Input
        label="ที่อยู่"
        value={form.address}
        onChange={e => setField('address', e.target.value)}
        placeholder="เลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="เบอร์โทรศัพท์"
          value={form.phone}
          onChange={e => setField('phone', e.target.value)}
          placeholder="02-xxx-xxxx"
        />
        <Input
          label="อีเมล"
          type="email"
          value={form.email}
          onChange={e => setField('email', e.target.value)}
          placeholder="info@company.co.th"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="สกุลเงิน"
          value={form.currency}
          onChange={e => setField('currency', e.target.value)}
        >
          <option value="THB">THB — บาทไทย</option>
          <option value="USD">USD — ดอลลาร์สหรัฐ</option>
          <option value="EUR">EUR — ยูโร</option>
        </Select>
        <Select
          label="เดือนเริ่มปีงบประมาณ"
          value={String(form.fiscalYearStart)}
          onChange={e => setField('fiscalYearStart', Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.isVatRegistered}
          onChange={e => setField('isVatRegistered', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</span>
      </label>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการบริษัท</h1>
          <p className="text-sm text-gray-500 mt-1">{companies.length} บริษัท</p>
        </div>
        <Button onClick={openCreate}>+ เพิ่มบริษัท</Button>
      </div>

      {/* Company Grid */}
      {companies.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="ยังไม่มีบริษัท"
          description="เริ่มต้นโดยเพิ่มบริษัทแรกของคุณ"
          action={<Button onClick={openCreate}>+ เพิ่มบริษัท</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(c => (
            <CompanyCard
              key={c.id}
              company={c}
              isActive={currentCompany?.id === c.id}
              onSelect={() => selectCompany(c.id)}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c)}
              onSeedCoa={() => handleSeedCoa(c)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={closeModals}
        title="เพิ่มบริษัทใหม่"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button loading={saving} onClick={handleSave}>บันทึก</Button>
          </>
        }
      >
        {CompanyForm}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTarget}
        onClose={closeModals}
        title={`แก้ไข: ${editTarget?.name ?? ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button loading={saving} onClick={handleSave}>บันทึก</Button>
          </>
        }
      >
        {CompanyForm}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={closeModals}
        title="ยืนยันการลบบริษัท"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModals}>ยกเลิก</Button>
            <Button variant="danger" loading={saving} onClick={handleDelete}>ลบบริษัท</Button>
          </>
        }
      >
        <p className="text-gray-700">
          คุณต้องการลบบริษัท <strong>{deleteTarget?.name}</strong> ใช่หรือไม่?
        </p>
        <p className="text-sm text-red-600 mt-2">
          การดำเนินการนี้จะลบข้อมูลทั้งหมดที่เกี่ยวข้อง และไม่สามารถกู้คืนได้
        </p>
      </Modal>
    </div>
  )
}
