use crate::db::DbState;
use crate::models::TrialBalanceRow;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VatReportRow {
    pub account_code: String,
    pub account_name: String,
    pub vat_type: String, // "Input" or "Output"
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VatSummary {
    pub year: i32,
    pub month: i32,
    pub input_vat: f64,
    pub output_vat: f64,
    pub net_vat: f64, // output - input (positive = must pay)
    pub rows: Vec<VatReportRow>,
}

#[tauri::command]
pub fn get_vat_report(
    db: State<DbState>,
    company_id: String,
    year: i32,
    month: i32,
) -> Result<VatSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let from_date = format!("{:04}-{:02}-01", year, month);
    let to_date = format!(
        "{:04}-{:02}-{:02}",
        year,
        month,
        days_in_month(year, month)
    );

    let mut stmt = conn
        .prepare(
            "SELECT a.account_code, a.account_name,
             CASE
               WHEN a.account_type = 'Asset' THEN 'Input'
               ELSE 'Output'
             END AS vat_type,
             CASE a.balance_side
               WHEN 'D' THEN COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)
               ELSE COALESCE(SUM(g.credit_amount), 0) - COALESCE(SUM(g.debit_amount), 0)
             END AS amount
             FROM accounts a
             JOIN gl_entries g ON g.account_id = a.id
               AND g.posting_date BETWEEN ?2 AND ?3
             JOIN journal_entries je ON je.id = g.journal_entry_id
               AND je.posting_status = 'Posted'
             WHERE a.company_id = ?1
               AND (a.account_name LIKE '%VAT%'
                    OR a.account_name LIKE '%ภาษีมูลค่าเพิ่ม%'
                    OR a.account_code LIKE '1151%'
                    OR a.account_code LIKE '2151%')
             GROUP BY a.id
             HAVING amount != 0
             ORDER BY vat_type DESC, a.account_code",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<VatReportRow> = stmt
        .query_map(rusqlite::params![company_id, from_date, to_date], |r| {
            Ok(VatReportRow {
                account_code: r.get(0)?,
                account_name: r.get(1)?,
                vat_type: r.get(2)?,
                amount: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let input_vat: f64 = rows.iter().filter(|r| r.vat_type == "Input").map(|r| r.amount).sum();
    let output_vat: f64 = rows.iter().filter(|r| r.vat_type == "Output").map(|r| r.amount).sum();

    Ok(VatSummary {
        year,
        month,
        input_vat,
        output_vat,
        net_vat: output_vat - input_vat,
        rows,
    })
}

fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) { 29 } else { 28 }
        }
        _ => 30,
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BalanceSheetItem {
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub sub_type: String,
    pub balance: f64,
}

#[tauri::command]
pub fn get_trial_balance(
    db: State<DbState>,
    company_id: String,
    as_of_date: String,
) -> Result<Vec<TrialBalanceRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT a.account_code, a.account_name, a.account_type,
             COALESCE(SUM(g.debit_amount), 0) AS total_debit,
             COALESCE(SUM(g.credit_amount), 0) AS total_credit
             FROM accounts a
             LEFT JOIN gl_entries g ON g.account_id = a.id
               AND g.posting_date <= ?2
             LEFT JOIN journal_entries je ON je.id = g.journal_entry_id
               AND je.posting_status = 'Posted'
             WHERE a.company_id = ?1 AND a.is_active = 1
             GROUP BY a.id, a.account_code, a.account_name, a.account_type
             HAVING total_debit > 0 OR total_credit > 0
             ORDER BY a.account_code",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![company_id, as_of_date], |row| {
            Ok(TrialBalanceRow {
                account_code: row.get(0)?,
                account_name: row.get(1)?,
                account_type: row.get(2)?,
                debit: row.get(3)?,
                credit: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn get_balance_sheet(
    db: State<DbState>,
    company_id: String,
    as_of_date: String,
) -> Result<Vec<BalanceSheetItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT a.account_code, a.account_name, a.account_type,
             COALESCE(a.sub_type, '') AS sub_type,
             CASE a.balance_side
               WHEN 'D' THEN COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)
               ELSE COALESCE(SUM(g.credit_amount), 0) - COALESCE(SUM(g.debit_amount), 0)
             END AS balance
             FROM accounts a
             LEFT JOIN gl_entries g ON g.account_id = a.id
               AND g.posting_date <= ?2
             LEFT JOIN journal_entries je ON je.id = g.journal_entry_id
               AND je.posting_status = 'Posted'
             WHERE a.company_id = ?1
               AND a.account_type IN ('Asset', 'Liability', 'Equity')
               AND a.is_active = 1
             GROUP BY a.id
             HAVING balance != 0
             ORDER BY a.account_code",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![company_id, as_of_date], |row| {
            Ok(BalanceSheetItem {
                account_code: row.get(0)?,
                account_name: row.get(1)?,
                account_type: row.get(2)?,
                sub_type: row.get(3)?,
                balance: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn get_income_statement(
    db: State<DbState>,
    company_id: String,
    from_date: String,
    to_date: String,
) -> Result<Vec<BalanceSheetItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT a.account_code, a.account_name, a.account_type,
             COALESCE(a.sub_type, '') AS sub_type,
             CASE a.balance_side
               WHEN 'C' THEN COALESCE(SUM(g.credit_amount), 0) - COALESCE(SUM(g.debit_amount), 0)
               ELSE COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)
             END AS balance
             FROM accounts a
             LEFT JOIN gl_entries g ON g.account_id = a.id
               AND g.posting_date BETWEEN ?2 AND ?3
             LEFT JOIN journal_entries je ON je.id = g.journal_entry_id
               AND je.posting_status = 'Posted'
             WHERE a.company_id = ?1
               AND a.account_type IN ('Revenue', 'Expense')
               AND a.is_active = 1
             GROUP BY a.id
             HAVING balance != 0
             ORDER BY a.account_code",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![company_id, from_date, to_date], |row| {
            Ok(BalanceSheetItem {
                account_code: row.get(0)?,
                account_name: row.get(1)?,
                account_type: row.get(2)?,
                sub_type: row.get(3)?,
                balance: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}
