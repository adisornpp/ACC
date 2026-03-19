use crate::db::DbState;
use crate::models::{Account, CreateAccountInput, UpdateAccountInput};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_accounts(db: State<DbState>, company_id: String) -> Result<Vec<Account>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, company_id, account_code, account_name, account_type, sub_type,
             balance_side, is_active, parent_account_id, created_at, updated_at
             FROM accounts WHERE company_id = ?1
             ORDER BY account_code",
        )
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map(rusqlite::params![company_id], |row| {
            Ok(Account {
                id: row.get(0)?,
                company_id: row.get(1)?,
                account_code: row.get(2)?,
                account_name: row.get(3)?,
                account_type: row.get(4)?,
                sub_type: row.get(5)?,
                balance_side: row.get::<_, Option<String>>(6)?.unwrap_or("D".into()),
                is_active: row.get::<_, i32>(7)? != 0,
                parent_account_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(accounts)
}

#[tauri::command]
pub fn create_account(
    db: State<DbState>,
    account: CreateAccountInput,
) -> Result<Account, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    // Validate account type
    let valid_types = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
    if !valid_types.contains(&account.account_type.as_str()) {
        return Err(format!("ประเภทบัญชีไม่ถูกต้อง: {}", account.account_type));
    }

    // Check duplicate code within company
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE company_id = ?1 AND account_code = ?2",
            rusqlite::params![account.company_id, account.account_code],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err(format!("รหัสบัญชี {} มีอยู่แล้ว", account.account_code));
    }

    conn.execute(
        "INSERT INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, parent_account_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id, account.company_id, account.account_code, account.account_name,
            account.account_type, account.sub_type, account.balance_side, account.parent_account_id
        ],
    )
    .map_err(|e| e.to_string())?;

    fetch_account(&conn, &id)
}

#[tauri::command]
pub fn update_account(
    db: State<DbState>,
    id: String,
    account: UpdateAccountInput,
) -> Result<Account, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if let Some(ref code) = account.account_code {
        // Check duplicate for other accounts
        let company_id: String = conn
            .query_row("SELECT company_id FROM accounts WHERE id = ?1", rusqlite::params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        let exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM accounts WHERE company_id = ?1 AND account_code = ?2 AND id != ?3",
                rusqlite::params![company_id, code, id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists > 0 {
            return Err(format!("รหัสบัญชี {} มีอยู่แล้ว", code));
        }
    }

    conn.execute(
        "UPDATE accounts SET
         account_code = COALESCE(?1, account_code),
         account_name = COALESCE(?2, account_name),
         account_type = COALESCE(?3, account_type),
         sub_type = COALESCE(?4, sub_type),
         balance_side = COALESCE(?5, balance_side),
         is_active = COALESCE(?6, is_active),
         parent_account_id = ?7,
         updated_at = datetime('now')
         WHERE id = ?8",
        rusqlite::params![
            account.account_code,
            account.account_name,
            account.account_type,
            account.sub_type,
            account.balance_side,
            account.is_active.map(|b| b as i32),
            account.parent_account_id,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    fetch_account(&conn, &id)
}

#[tauri::command]
pub fn delete_account(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Check if account has GL entries
    let usage: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM gl_entries WHERE account_id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if usage > 0 {
        return Err("ไม่สามารถลบบัญชีที่มีรายการบัญชีได้".into());
    }
    conn.execute("DELETE FROM accounts WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn seed_thai_coa(db: State<DbState>, company_id: String) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let accounts = thai_coa_template();
    let mut count = 0i64;

    for (code, name, acc_type, sub_type, side) in &accounts {
        let id = Uuid::new_v4().to_string();
        let result = conn.execute(
            "INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, company_id, code, name, acc_type, sub_type, side],
        );
        if result.map(|n| n > 0).unwrap_or(false) {
            count += 1;
        }
    }

    Ok(count)
}

fn fetch_account(conn: &rusqlite::Connection, id: &str) -> Result<Account, String> {
    conn.query_row(
        "SELECT id, company_id, account_code, account_name, account_type, sub_type,
         balance_side, is_active, parent_account_id, created_at, updated_at
         FROM accounts WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Account {
                id: row.get(0)?,
                company_id: row.get(1)?,
                account_code: row.get(2)?,
                account_name: row.get(3)?,
                account_type: row.get(4)?,
                sub_type: row.get(5)?,
                balance_side: row.get::<_, Option<String>>(6)?.unwrap_or("D".into()),
                is_active: row.get::<_, i32>(7)? != 0,
                parent_account_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn thai_coa_template() -> Vec<(&'static str, &'static str, &'static str, &'static str, &'static str)> {
    vec![
        // สินทรัพย์หมุนเวียน
        ("1100", "เงินสด",                        "Asset", "Current Asset", "D"),
        ("1110", "เงินฝากธนาคาร",                  "Asset", "Current Asset", "D"),
        ("1120", "เงินฝากออมทรัพย์",                "Asset", "Current Asset", "D"),
        ("1200", "ลูกหนี้การค้า",                   "Asset", "Current Asset", "D"),
        ("1210", "ลูกหนี้อื่น",                     "Asset", "Current Asset", "D"),
        ("1300", "สินค้าคงเหลือ",                   "Asset", "Current Asset", "D"),
        ("1400", "เงินลงทุนระยะสั้น",                "Asset", "Current Asset", "D"),
        ("1500", "ค่าใช้จ่ายจ่ายล่วงหน้า",           "Asset", "Current Asset", "D"),
        ("1510", "ภาษีซื้อรอเรียกคืน",               "Asset", "Current Asset", "D"),
        // สินทรัพย์ไม่หมุนเวียน
        ("1600", "ที่ดิน",                          "Asset", "Fixed Asset",   "D"),
        ("1610", "อาคารและสิ่งปลูกสร้าง",            "Asset", "Fixed Asset",   "D"),
        ("1620", "เครื่องจักรและอุปกรณ์",             "Asset", "Fixed Asset",   "D"),
        ("1630", "เฟอร์นิเจอร์และอุปกรณ์สำนักงาน",  "Asset", "Fixed Asset",   "D"),
        ("1640", "ยานพาหนะ",                        "Asset", "Fixed Asset",   "D"),
        ("1710", "ค่าเสื่อมราคาสะสม-อาคาร",         "Asset", "Accumulated Dep", "C"),
        ("1720", "ค่าเสื่อมราคาสะสม-เครื่องจักร",    "Asset", "Accumulated Dep", "C"),
        ("1730", "ค่าเสื่อมราคาสะสม-เฟอร์นิเจอร์",  "Asset", "Accumulated Dep", "C"),
        ("1740", "ค่าเสื่อมราคาสะสม-ยานพาหนะ",      "Asset", "Accumulated Dep", "C"),
        ("1800", "โปรแกรมคอมพิวเตอร์",               "Asset", "Intangible",    "D"),
        // หนี้สินหมุนเวียน
        ("2100", "เจ้าหนี้การค้า",                   "Liability", "Current Liability", "C"),
        ("2110", "เจ้าหนี้อื่น",                     "Liability", "Current Liability", "C"),
        ("2200", "ค่าใช้จ่ายค้างจ่าย",               "Liability", "Current Liability", "C"),
        ("2210", "ค่าจ้างค้างจ่าย",                  "Liability", "Current Liability", "C"),
        ("2310", "ภาษีเงินได้นิติบุคคลค้างจ่าย",     "Liability", "Current Liability", "C"),
        ("2320", "ภาษีมูลค่าเพิ่มค้างจ่าย",          "Liability", "Current Liability", "C"),
        ("2321", "ภาษีขาย",                          "Liability", "Current Liability", "C"),
        ("2330", "เงินประกันสังคมค้างจ่าย",          "Liability", "Current Liability", "C"),
        ("2331", "ประกันสังคม-ส่วนพนักงาน",           "Liability", "Current Liability", "C"),
        ("2332", "ประกันสังคม-ส่วนนายจ้าง",           "Liability", "Current Liability", "C"),
        ("2340", "ภาษีหัก ณ ที่จ่ายค้างนำส่ง",       "Liability", "Current Liability", "C"),
        ("2400", "เงินกู้ยืมระยะสั้น",                "Liability", "Current Liability", "C"),
        ("2500", "รายได้รับล่วงหน้า",                 "Liability", "Current Liability", "C"),
        // หนี้สินระยะยาว
        ("2600", "เงินกู้ยืมระยะยาว",                "Liability", "Long-term Liability", "C"),
        ("2700", "หนี้สินผลประโยชน์พนักงาน",         "Liability", "Long-term Liability", "C"),
        // ทุน
        ("3100", "ทุนเรือนหุ้น",                     "Equity", "Paid-in Capital", "C"),
        ("3110", "ส่วนเกินมูลค่าหุ้น",                "Equity", "Paid-in Capital", "C"),
        ("3200", "กำไรสะสม",                         "Equity", "Retained Earnings", "C"),
        ("3300", "เงินปันผลจ่าย",                    "Equity", "Dividends", "D"),
        // รายได้
        ("4100", "รายได้จากการขาย",                  "Revenue", "Operating Revenue", "C"),
        ("4110", "ส่วนลดการขาย",                    "Revenue", "Operating Revenue", "D"),
        ("4200", "รายได้จากการให้บริการ",             "Revenue", "Operating Revenue", "C"),
        ("4300", "รายได้ดอกเบี้ย",                   "Revenue", "Other Income", "C"),
        ("4310", "รายได้เงินปันผล",                  "Revenue", "Other Income", "C"),
        ("4320", "กำไรจากการขายสินทรัพย์",           "Revenue", "Other Income", "C"),
        ("4390", "รายได้อื่น",                       "Revenue", "Other Income", "C"),
        // ต้นทุนและค่าใช้จ่าย
        ("5100", "ต้นทุนสินค้าขาย",                  "Expense", "Cost of Sales", "D"),
        ("5110", "ต้นทุนบริการ",                     "Expense", "Cost of Sales", "D"),
        ("5200", "เงินเดือนและค่าจ้าง",              "Expense", "Personnel", "D"),
        ("5210", "โบนัสและค่าตอบแทนอื่น",           "Expense", "Personnel", "D"),
        ("5220", "เงินสมทบประกันสังคม-นายจ้าง",     "Expense", "Personnel", "D"),
        ("5230", "ค่ารักษาพยาบาล",                  "Expense", "Personnel", "D"),
        ("5300", "ค่าเช่า",                          "Expense", "Operating", "D"),
        ("5310", "ค่าไฟฟ้าและน้ำประปา",              "Expense", "Operating", "D"),
        ("5320", "ค่าโทรศัพท์และอินเทอร์เน็ต",       "Expense", "Operating", "D"),
        ("5330", "ค่าซ่อมบำรุง",                    "Expense", "Operating", "D"),
        ("5340", "ค่าเสื่อมราคา",                    "Expense", "Operating", "D"),
        ("5350", "ค่าประกันภัย",                    "Expense", "Operating", "D"),
        ("5360", "ค่าพาหนะและเดินทาง",              "Expense", "Operating", "D"),
        ("5370", "ค่ารับรอง",                       "Expense", "Operating", "D"),
        ("5380", "ค่าโฆษณาและส่งเสริมการขาย",      "Expense", "Marketing", "D"),
        ("5400", "ค่าธรรมเนียมวิชาชีพ",             "Expense", "Professional", "D"),
        ("5410", "ค่าตรวจสอบบัญชี",                "Expense", "Professional", "D"),
        ("5420", "ค่าที่ปรึกษากฎหมาย",              "Expense", "Professional", "D"),
        ("5500", "ดอกเบี้ยจ่าย",                    "Expense", "Finance", "D"),
        ("5510", "ค่าธรรมเนียมธนาคาร",              "Expense", "Finance", "D"),
        ("5600", "ภาษีเงินได้นิติบุคคล",             "Expense", "Tax", "D"),
        ("5700", "ขาดทุนจากการขายสินทรัพย์",        "Expense", "Other Expense", "D"),
        ("5900", "ค่าใช้จ่ายอื่น",                  "Expense", "Other Expense", "D"),
    ]
}
