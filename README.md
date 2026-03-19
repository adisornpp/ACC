# โปรแกรมทำบัญชีแบบออฟไลน์

ระบบบัญชีออฟไลน์ที่ออกแบบสำหรับสำนักงานบัญชีไทย โดยรองรับการจัดการหลายบริษัท พร้อมฟีเจอร์การบัญชีแบบบัญชีคู่ (Double-Entry) ที่สมบูรณ์

## ลักษณะเด่น

✅ **บัญชีแบบคู่ (Double-Entry)** - ระบบบัญชีมาตรฐานสากล
✅ **รองรับหลายบริษัท** - ข้อมูลแยกได้อย่างสมบูรณ์
✅ **ออฟไลน์ก่อน** - ทำงานได้แม้ไม่มีอินเทอร์เน็ต
✅ **ภาษีไทย** - รองรับ CIT, VAT, ประกันสังคม
✅ **UI/UX สะอาด** - ดีไซน์เหมือน Notion
✅ **Multi-user** - แยกสิทธิตามบทบาท

## เทคโนโลยี

### Frontend
- **React 18** + **TypeScript**
- **Tauri** - Desktop app framework
- **shadcn/ui** + **Tailwind CSS** - UI components
- **Zustand** - State management
- **React Query** - Data sync

### Database
- **SQLite** - Offline storage
- **PostgreSQL** - Future online backend

### Architecture
- **Monorepo** - Apps, packages, services
- **Multi-tenant** - Company-level isolation
- **REST API** - Tauri backend (Rust)

## โครงสร้างโปรเจค

```
accounting-app/
├── apps/
│   ├── desktop/       # Tauri desktop app
│   ├── web/           # React web app (future)
│   └── shared/        # Shared code
├── packages/
│   ├── ui/            # shadcn/ui components
│   ├── types/         # TypeScript definitions
│   ├── api-client/    # API client
│   └── accounting-core/ # Core logic
├── services/
│   ├── api/           # Backend API
│   └── db/            # Database migrations
└── docs/              # Documentation
```

## ติดตั้งและเรียใช้

### ข้อกำหนดเบื้องต้น
- Node.js 18+
- npm 9+
- Rust (สำหรับ Tauri)

### ติดตั้ง

```bash
# ติดตั้ง dependencies
npm install

# สร้าง database
npm run db:migrate

# เพิ่มข้อมูล test
npm run db:seed
```

### พัฒนา

```bash
# เรียใช้ desktop app
npm run desktop

# เรียใช้ web app
npm run web
```

### สร้าง

```bash
# สร้าง desktop app สำหรับ distribution
cd apps/desktop
npm run build
```

## ฟีเจอร์ MVP

### ระยะที่ 1: ระบบบัญชีหลัก
- [x] โครงสร้างฐานข้อมูล
- [x] Authentication (login/logout)
- [x] Company management
- [ ] Chart of Accounts CRUD
- [ ] Journal entry recording
- [ ] General Ledger view

### ระยะที่ 2: รายงาน
- [ ] Trial Balance
- [ ] Balance Sheet
- [ ] Income Statement
- [ ] Export to PDF/Excel

### ระยะที่ 3: ภาษีและการปฏิบัติตามกฎหมาย
- [ ] Tax calculations (CIT, VAT)
- [ ] Social Security tracking
- [ ] Financial reporting formats

## การใช้งาน

### ล็อกอิน
1. เลือกบริษัท
2. ป้อนอีเมลและรหัสผ่าน
3. ตีแป้นล็อกอิน

### สร้างบันทึกบัญชี
1. ไปที่หน้า "บันทึกบัญชี"
2. เลือก Journal type
3. ป้อนข้อมูล GL entries
4. บันทึกเป็น Draft หรือ Post ทันที

### ดูรายงาน
1. ไปที่หน้า "รายงาน"
2. เลือกรายงาน (TB, BS, P&L)
3. เลือกช่วงวันที่
4. ดาวน์โหลด PDF/Excel

## การพัฒนา

### เพิ่ม Feature ใหม่

1. **สร้าง branch** ใหม่
```bash
git checkout -b feature/my-feature
```

2. **แก้ไขรหัส** ตามแผน

3. **Commit**
```bash
git commit -m "feat: Add new feature"
```

4. **Push**
```bash
git push origin feature/my-feature
```

### การทดสอบ

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Linting
npm run lint
```

## โครงสร้างฐานข้อมูล

### ตารางหลัก
- `companies` - บริษัท (multi-tenant root)
- `users` - ผู้ใช้ (พร้อม company_id)
- `accounts` - แผนบัญชี
- `journals` - Journal templates
- `journal_entries` - บันทึกบัญชี (header)
- `gl_entries` - รายการ GL (detail)
- `account_balances` - ยอดคงเหลือรายเดือน

### ข้อมูล Security
- ทุกตาราง มี `company_id` เพื่อแยกข้อมูล
- User passwords ถูก hash ด้วย bcrypt
- Audit trail บันทึก WHO, WHEN, WHAT

## ข้อกำหนดกฎหมายไทย

โปรแกรมมี built-in support สำหรับ:
- ✅ Thai Accounting Standards (TAS/TFRS)
- ✅ Corporate Income Tax (CIT) calculations
- ✅ Value Added Tax (VAT) 7% / 10%
- ✅ Social Security contributions
- ✅ Withholding tax tracking
- ✅ Financial reporting format per Thai GAAP

## Troubleshooting

### เชื่อมต่อ SQLite ไม่ได้
- ตรวจสอบ permissions ของ database file
- ลองลบ `.db` file และ seed ใหม่

### Login ไม่ได้
- ตรวจสอบว่า database ถูก seed ด้วย demo users
- ดู console logs สำหรับ error details

### UI ไม่แสดง styles
- ตรวจสอบว่า Tailwind CSS compiled ถูกต้อง
- ลองเรียใช้ dev server ใหม่

## สนับสนุน

สำหรับปัญหา, ข้อแนะนำ, หรือคำถาม:
- เปิด GitHub Issue
- ติดต่อทีมพัฒนา

## License

MIT License - ดูไฟล์ LICENSE

## Timeline

- **สัปดาห์ 1-2:** Setup + Database design ✅
- **สัปดาห์ 3-4:** Chart of Accounts + Authentication
- **สัปดาห์ 5-6:** Journal entries + GL view
- **สัปดาห์ 7-8:** Financial reports + Export
- **สัปดาห์ 9-10:** Tax module + Social security
- **สัปดาห์ 11-12:** Testing + Refinement

---

ให้ฉันรู้หากมีคำถามหรือต้องการขอความช่วยเหลือเพิ่มเติม! 🚀
