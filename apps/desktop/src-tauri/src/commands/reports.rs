use crate::db::DbState;
use crate::models::TrialBalanceRow;
use serde::{Deserialize, Serialize};
use tauri::State;

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
