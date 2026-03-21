import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useCompanyStore } from '@/store/companyStore'

interface SetupStep {
  company: { name: string; taxId: string }
  admin: { email: string; password: string; confirmPassword: string; fullName: string }
}

export default function SetupPage() {
  const { loadCompanies } = useCompanyStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [companyId, setCompanyId] = useState('')

  const [data, setData] = useState<SetupStep>({
    company: { name: '', taxId: '' },
    admin: { email: '', password: '', confirmPassword: '', fullName: '' },
  })

  const setCompanyField = (field: keyof SetupStep['company'], value: string) =>
    setData(d => ({ ...d, company: { ...d.company, [field]: value } }))
  const setAdminField = (field: keyof SetupStep['admin'], value: string) =>
    setData(d => ({ ...d, admin: { ...d.admin, [field]: value } }))

  const handleStep1 = async () => {
    setError('')
    if (!data.company.name.trim()) { setError('กรุณากรอกชื่อบริษัท'); return }
    setLoading(true)
    try {
      const company = await invoke<{ id: string }>('create_company', {
        company: {
          name: data.company.name.trim(),
          taxId: data.company.taxId.trim() || null,
          address: null, phone: null, email: null,
          currency: 'THB', fiscalYearStart: 1,
          vatRegistered: false,
        },
      })
      setCompanyId(company.id)
      await loadCompanies()
      setStep(2)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async () => {
    setError('')
    const { email, password, confirmPassword, fullName } = data.admin
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-สกุล'); return }
    if (!email.trim()) { setError('กรุณากรอกอีเมล'); return }
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }
    setLoading(true)
    try {
      await invoke('create_admin_user', {
        companyId,
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      })
      // Seed Thai COA
      try { await invoke('seed_thai_coa', { companyId }) } catch (_) {}
      // Redirect to login
      window.location.reload()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าเริ่มต้น</h1>
          <p className="text-gray-500 text-sm mt-1">ยินดีต้อนรับสู่โปรแกรมทำบัญชี</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">ขั้นตอนที่ 1: ข้อมูลบริษัท</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบริษัท *</label>
                  <input className={inputClass} value={data.company.name}
                    onChange={e => setCompanyField('name', e.target.value)}
                    placeholder="บริษัท ตัวอย่าง จำกัด" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                  <input className={inputClass} value={data.company.taxId}
                    onChange={e => setCompanyField('taxId', e.target.value)}
                    placeholder="0000000000000 (ไม่จำเป็น)" maxLength={13} />
                </div>
              </div>
            </div>
            <button
              onClick={handleStep1}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'ถัดไป →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">ขั้นตอนที่ 2: สร้างบัญชีผู้ดูแลระบบ</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-สกุล *</label>
                  <input className={inputClass} value={data.admin.fullName}
                    onChange={e => setAdminField('fullName', e.target.value)}
                    placeholder="ชื่อ สกุล" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
                  <input className={inputClass} type="email" value={data.admin.email}
                    onChange={e => setAdminField('email', e.target.value)}
                    placeholder="admin@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน *</label>
                  <input className={inputClass} type="password" value={data.admin.password}
                    onChange={e => setAdminField('password', e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่าน *</label>
                  <input className={inputClass} type="password" value={data.admin.confirmPassword}
                    onChange={e => setAdminField('confirmPassword', e.target.value)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                ← ย้อนกลับ
              </button>
              <button onClick={handleStep2} disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? 'กำลังตั้งค่า...' : 'เสร็จสิ้น'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
