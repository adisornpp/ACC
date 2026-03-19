use crate::db::DbState;
use crate::models::{Company, CreateCompanyInput};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_companies(db: State<DbState>) -> Result<Vec<Company>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, tax_id, address, phone, email, currency,
             fiscal_year_start, vat_registered, created_at, updated_at
             FROM companies ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let companies = stmt
        .query_map([], |row| {
            Ok(Company {
                id: row.get(0)?,
                name: row.get(1)?,
                tax_id: row.get(2)?,
                address: row.get(3)?,
                phone: row.get(4)?,
                email: row.get(5)?,
                currency: row.get::<_, Option<String>>(6)?.unwrap_or("THB".into()),
                fiscal_year_start: row.get::<_, Option<i32>>(7)?.unwrap_or(1),
                vat_registered: row.get::<_, i32>(8)? != 0,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(companies)
}

#[tauri::command]
pub fn create_company(
    db: State<DbState>,
    company: CreateCompanyInput,
) -> Result<Company, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let currency = company.currency.unwrap_or("THB".into());
    let fiscal_year_start = company.fiscal_year_start.unwrap_or(1);
    let vat_registered = company.vat_registered.unwrap_or(false) as i32;

    conn.execute(
        "INSERT INTO companies (id, name, tax_id, address, phone, email, currency, fiscal_year_start, vat_registered)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            id, company.name, company.tax_id, company.address,
            company.phone, company.email, currency, fiscal_year_start, vat_registered
        ],
    )
    .map_err(|e| e.to_string())?;

    // Seed default journals for this company
    seed_default_journals(&conn, &id)?;

    let created = conn
        .query_row(
            "SELECT id, name, tax_id, address, phone, email, currency,
             fiscal_year_start, vat_registered, created_at, updated_at
             FROM companies WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Company {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    tax_id: row.get(2)?,
                    address: row.get(3)?,
                    phone: row.get(4)?,
                    email: row.get(5)?,
                    currency: row.get::<_, Option<String>>(6)?.unwrap_or("THB".into()),
                    fiscal_year_start: row.get::<_, Option<i32>>(7)?.unwrap_or(1),
                    vat_registered: row.get::<_, i32>(8)? != 0,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(created)
}

#[tauri::command]
pub fn update_company(
    db: State<DbState>,
    id: String,
    company: CreateCompanyInput,
) -> Result<Company, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE companies SET name=?1, tax_id=?2, address=?3, phone=?4, email=?5,
         currency=?6, fiscal_year_start=?7, vat_registered=?8, updated_at=datetime('now')
         WHERE id=?9",
        rusqlite::params![
            company.name, company.tax_id, company.address, company.phone, company.email,
            company.currency.unwrap_or("THB".into()),
            company.fiscal_year_start.unwrap_or(1),
            company.vat_registered.unwrap_or(false) as i32,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    let updated = conn
        .query_row(
            "SELECT id, name, tax_id, address, phone, email, currency,
             fiscal_year_start, vat_registered, created_at, updated_at
             FROM companies WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Company {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    tax_id: row.get(2)?,
                    address: row.get(3)?,
                    phone: row.get(4)?,
                    email: row.get(5)?,
                    currency: row.get::<_, Option<String>>(6)?.unwrap_or("THB".into()),
                    fiscal_year_start: row.get::<_, Option<i32>>(7)?.unwrap_or(1),
                    vat_registered: row.get::<_, i32>(8)? != 0,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_company(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM companies WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn seed_default_journals(conn: &rusqlite::Connection, company_id: &str) -> Result<(), String> {
    let journals = vec![
        ("JV", "สมุดรายวันทั่วไป", "General"),
        ("SJ", "สมุดรายวันขาย", "Sales"),
        ("PJ", "สมุดรายวันซื้อ", "Purchase"),
        ("BJ", "สมุดรายวันธนาคาร", "Bank"),
        ("CJ", "สมุดรายวันเงินสด", "Cash"),
    ];
    for (code, name, jtype) in journals {
        let jid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO journals (id, company_id, journal_code, journal_name, journal_type)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![jid, company_id, code, name, jtype],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
