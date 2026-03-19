use crate::db::DbState;
use crate::models::{JournalEntry, GlEntry, CreateJournalEntryInput, Journal};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_journals(db: State<DbState>, company_id: String) -> Result<Vec<Journal>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, company_id, journal_code, journal_name, journal_type, description, is_active, created_at
             FROM journals WHERE company_id = ?1 AND is_active = 1 ORDER BY journal_code",
        )
        .map_err(|e| e.to_string())?;

    let journals = stmt
        .query_map(rusqlite::params![company_id], |row| {
            Ok(Journal {
                id: row.get(0)?,
                company_id: row.get(1)?,
                journal_code: row.get(2)?,
                journal_name: row.get(3)?,
                journal_type: row.get(4)?,
                description: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(journals)
}

#[tauri::command]
pub fn get_journal_entries(
    db: State<DbState>,
    company_id: String,
    from_date: Option<String>,
    to_date: Option<String>,
    status: Option<String>,
) -> Result<Vec<JournalEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT je.id, je.company_id, je.journal_id, je.entry_number, je.entry_date,
         je.description, je.posting_status, je.total_debit, je.total_credit,
         je.created_by, je.created_at, je.updated_at, je.posted_at, je.posted_by
         FROM journal_entries je WHERE je.company_id = ?1".to_string();

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(company_id.clone())];

    if let Some(ref fd) = from_date {
        query.push_str(" AND je.entry_date >= ?");
        query.push_str(&(params.len() + 1).to_string());
        params.push(Box::new(fd.clone()));
    }
    if let Some(ref td) = to_date {
        query.push_str(" AND je.entry_date <= ?");
        query.push_str(&(params.len() + 1).to_string());
        params.push(Box::new(td.clone()));
    }
    if let Some(ref st) = status {
        query.push_str(" AND je.posting_status = ?");
        query.push_str(&(params.len() + 1).to_string());
        params.push(Box::new(st.clone()));
    }

    query.push_str(" ORDER BY je.entry_date DESC, je.entry_number DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let entries = stmt
        .query_map(refs.as_slice(), |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                company_id: row.get(1)?,
                journal_id: row.get(2)?,
                entry_number: row.get(3)?,
                entry_date: row.get(4)?,
                description: row.get(5)?,
                posting_status: row.get(6)?,
                total_debit: row.get(7)?,
                total_credit: row.get(8)?,
                created_by: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                posted_at: row.get(12)?,
                posted_by: row.get(13)?,
                lines: None,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub fn create_journal_entry(
    db: State<DbState>,
    entry: CreateJournalEntryInput,
    user_id: String,
) -> Result<JournalEntry, String> {
    // Validate double-entry
    let total_debit: f64 = entry.lines.iter().map(|l| l.debit_amount).sum();
    let total_credit: f64 = entry.lines.iter().map(|l| l.credit_amount).sum();
    if (total_debit - total_credit).abs() > 0.01 {
        return Err(format!(
            "ยอดเดบิต ({:.2}) ไม่เท่ากับยอดเครดิต ({:.2})",
            total_debit, total_credit
        ));
    }
    if entry.lines.is_empty() {
        return Err("กรุณาระบุรายการบัญชีอย่างน้อย 1 รายการ".into());
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    // Generate entry number: JV-YYYYMM-XXXX
    let entry_number = generate_entry_number(&conn, &entry.company_id, &entry.journal_id)?;

    conn.execute(
        "INSERT INTO journal_entries
         (id, company_id, journal_id, entry_number, entry_date, description,
          posting_status, total_debit, total_credit, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'Draft', ?7, ?8, ?9)",
        rusqlite::params![
            id, entry.company_id, entry.journal_id, entry_number,
            entry.entry_date, entry.description, total_debit, total_credit, user_id
        ],
    )
    .map_err(|e| e.to_string())?;

    for (idx, line) in entry.lines.iter().enumerate() {
        let line_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO gl_entries
             (id, company_id, journal_entry_id, account_id, line_number, description, debit_amount, credit_amount, posting_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                line_id, entry.company_id, id, line.account_id,
                idx + 1, line.description, line.debit_amount, line.credit_amount,
                entry.entry_date
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    fetch_journal_entry(&conn, &id)
}

#[tauri::command]
pub fn post_journal_entry(
    db: State<DbState>,
    id: String,
    user_id: String,
) -> Result<JournalEntry, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Only allow posting Draft entries
    let status: String = conn
        .query_row("SELECT posting_status FROM journal_entries WHERE id = ?1", rusqlite::params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if status != "Draft" {
        return Err(format!("ไม่สามารถ Post รายการที่มีสถานะ {}", status));
    }

    conn.execute(
        "UPDATE journal_entries SET posting_status='Posted', posted_at=datetime('now'), posted_by=?1, updated_at=datetime('now') WHERE id=?2",
        rusqlite::params![user_id, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_journal_entry(&conn, &id)
}

#[tauri::command]
pub fn get_gl_entries(
    db: State<DbState>,
    company_id: String,
    account_id: String,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<GlEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT g.id, g.company_id, g.journal_entry_id, g.account_id, g.line_number,
         g.description, g.debit_amount, g.credit_amount, g.posting_date, g.created_at
         FROM gl_entries g
         JOIN journal_entries je ON je.id = g.journal_entry_id
         WHERE g.company_id = ?1 AND g.account_id = ?2
         AND je.posting_status = 'Posted'".to_string();

    let mut params: Vec<Box<dyn rusqlite::ToSql>> =
        vec![Box::new(company_id), Box::new(account_id)];

    if let Some(ref fd) = from_date {
        query.push_str(" AND g.posting_date >= ?");
        query.push_str(&(params.len() + 1).to_string());
        params.push(Box::new(fd.clone()));
    }
    if let Some(ref td) = to_date {
        query.push_str(" AND g.posting_date <= ?");
        query.push_str(&(params.len() + 1).to_string());
        params.push(Box::new(td.clone()));
    }

    query.push_str(" ORDER BY g.posting_date, g.created_at");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let entries = stmt
        .query_map(refs.as_slice(), |row| {
            Ok(GlEntry {
                id: row.get(0)?,
                company_id: row.get(1)?,
                journal_entry_id: row.get(2)?,
                account_id: row.get(3)?,
                line_number: row.get(4)?,
                description: row.get(5)?,
                debit_amount: row.get(6)?,
                credit_amount: row.get(7)?,
                posting_date: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

fn fetch_journal_entry(conn: &rusqlite::Connection, id: &str) -> Result<JournalEntry, String> {
    let entry = conn
        .query_row(
            "SELECT id, company_id, journal_id, entry_number, entry_date, description,
             posting_status, total_debit, total_credit, created_by, created_at, updated_at, posted_at, posted_by
             FROM journal_entries WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(JournalEntry {
                    id: row.get(0)?,
                    company_id: row.get(1)?,
                    journal_id: row.get(2)?,
                    entry_number: row.get(3)?,
                    entry_date: row.get(4)?,
                    description: row.get(5)?,
                    posting_status: row.get(6)?,
                    total_debit: row.get(7)?,
                    total_credit: row.get(8)?,
                    created_by: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    posted_at: row.get(12)?,
                    posted_by: row.get(13)?,
                    lines: None,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Fetch lines
    let mut stmt = conn
        .prepare(
            "SELECT id, company_id, journal_entry_id, account_id, line_number,
             description, debit_amount, credit_amount, posting_date, created_at
             FROM gl_entries WHERE journal_entry_id = ?1 ORDER BY line_number",
        )
        .map_err(|e| e.to_string())?;

    let lines = stmt
        .query_map(rusqlite::params![id], |row| {
            Ok(GlEntry {
                id: row.get(0)?,
                company_id: row.get(1)?,
                journal_entry_id: row.get(2)?,
                account_id: row.get(3)?,
                line_number: row.get(4)?,
                description: row.get(5)?,
                debit_amount: row.get(6)?,
                credit_amount: row.get(7)?,
                posting_date: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(JournalEntry { lines: Some(lines), ..entry })
}

fn generate_entry_number(
    conn: &rusqlite::Connection,
    company_id: &str,
    journal_id: &str,
) -> Result<String, String> {
    let journal_code: String = conn
        .query_row(
            "SELECT journal_code FROM journals WHERE id = ?1",
            rusqlite::params![journal_id],
            |row| row.get(0),
        )
        .unwrap_or("JV".into());

    let now = chrono::Local::now();
    let prefix = format!("{}-{}", journal_code, now.format("%Y%m"));

    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM journal_entries WHERE company_id = ?1 AND entry_number LIKE ?2",
            rusqlite::params![company_id, format!("{}%", prefix)],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(format!("{}-{:04}", prefix, count + 1))
}
