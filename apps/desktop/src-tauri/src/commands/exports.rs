use crate::db::DbState;
use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Workbook, XlsxError};
use tauri::State;

fn xlsx_error(e: XlsxError) -> String {
    e.to_string()
}

// ---- Trial Balance Excel ------------------------------------------------

#[tauri::command]
pub fn export_trial_balance_excel(
    db: State<DbState>,
    company_id: String,
    company_name: String,
    as_of_date: String,
    save_path: String,
) -> Result<(), String> {
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

    let rows: Vec<(String, String, String, f64, f64)> = stmt
        .query_map(rusqlite::params![company_id, as_of_date], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    let title_fmt = Format::new()
        .set_bold()
        .set_font_size(14.0)
        .set_align(FormatAlign::Center);
    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(0x4F46E5_u32)
        .set_font_color(0xFFFFFF_u32)
        .set_border(FormatBorder::Thin);
    let num_fmt = Format::new()
        .set_num_format("#,##0.00")
        .set_border(FormatBorder::Thin);
    let cell_fmt = Format::new().set_border(FormatBorder::Thin);
    let total_fmt = Format::new()
        .set_bold()
        .set_num_format("#,##0.00")
        .set_top_border(FormatBorder::Double);

    sheet.merge_range(0, 0, 0, 4, &company_name, &title_fmt).map_err(xlsx_error)?;
    sheet.write_string(1, 0, &format!("งบทดลอง ณ วันที่ {}", as_of_date)).map_err(xlsx_error)?;

    let headers = ["รหัสบัญชี", "ชื่อบัญชี", "ประเภท", "เดบิต", "เครดิต"];
    for (i, h) in headers.iter().enumerate() {
        sheet.write_string_with_format(3, i as u16, h, &header_fmt).map_err(xlsx_error)?;
    }

    sheet.set_column_width(0, 12).map_err(xlsx_error)?;
    sheet.set_column_width(1, 40).map_err(xlsx_error)?;
    sheet.set_column_width(2, 16).map_err(xlsx_error)?;
    sheet.set_column_width(3, 18).map_err(xlsx_error)?;
    sheet.set_column_width(4, 18).map_err(xlsx_error)?;

    let mut total_debit = 0f64;
    let mut total_credit = 0f64;

    for (i, row) in rows.iter().enumerate() {
        let r = (4 + i) as u32;
        sheet.write_string_with_format(r, 0, &row.0, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(r, 1, &row.1, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(r, 2, &row.2, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_number_with_format(r, 3, row.3, &num_fmt).map_err(xlsx_error)?;
        sheet.write_number_with_format(r, 4, row.4, &num_fmt).map_err(xlsx_error)?;
        total_debit += row.3;
        total_credit += row.4;
    }

    let total_row = (4 + rows.len()) as u32;
    sheet.write_string_with_format(total_row, 1, "รวมทั้งสิ้น", &total_fmt).map_err(xlsx_error)?;
    sheet.write_number_with_format(total_row, 3, total_debit, &total_fmt).map_err(xlsx_error)?;
    sheet.write_number_with_format(total_row, 4, total_credit, &total_fmt).map_err(xlsx_error)?;

    workbook.save(&save_path).map_err(xlsx_error)?;
    Ok(())
}

// ---- Income Statement Excel --------------------------------------------

#[tauri::command]
pub fn export_income_statement_excel(
    db: State<DbState>,
    company_id: String,
    company_name: String,
    from_date: String,
    to_date: String,
    save_path: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT a.account_code, a.account_name, a.account_type,
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

    let rows: Vec<(String, String, String, f64)> = stmt
        .query_map(rusqlite::params![company_id, from_date, to_date], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();

    let title_fmt = Format::new().set_bold().set_font_size(14.0).set_align(FormatAlign::Center);
    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(0x4F46E5_u32)
        .set_font_color(0xFFFFFF_u32)
        .set_border(FormatBorder::Thin);
    let num_fmt = Format::new().set_num_format("#,##0.00").set_border(FormatBorder::Thin);
    let cell_fmt = Format::new().set_border(FormatBorder::Thin);
    let section_fmt = Format::new().set_bold().set_background_color(0xE0E7FF_u32);
    let total_fmt = Format::new().set_bold().set_num_format("#,##0.00").set_top_border(FormatBorder::Double);

    sheet.merge_range(0, 0, 0, 3, &company_name, &title_fmt).map_err(xlsx_error)?;
    sheet
        .write_string(1, 0, &format!("งบกำไรขาดทุน ตั้งแต่ {} ถึง {}", from_date, to_date))
        .map_err(xlsx_error)?;

    let headers = ["รหัสบัญชี", "ชื่อบัญชี", "ประเภท", "จำนวนเงิน"];
    for (i, h) in headers.iter().enumerate() {
        sheet.write_string_with_format(3, i as u16, h, &header_fmt).map_err(xlsx_error)?;
    }
    sheet.set_column_width(0, 12).map_err(xlsx_error)?;
    sheet.set_column_width(1, 40).map_err(xlsx_error)?;
    sheet.set_column_width(2, 16).map_err(xlsx_error)?;
    sheet.set_column_width(3, 18).map_err(xlsx_error)?;

    let mut current_row = 4u32;
    let mut total_revenue = 0f64;
    let mut total_expense = 0f64;

    // Revenue section
    sheet.merge_range(current_row, 0, current_row, 3, "รายได้", &section_fmt).map_err(xlsx_error)?;
    current_row += 1;
    for row in rows.iter().filter(|r| r.2 == "Revenue") {
        sheet.write_string_with_format(current_row, 0, &row.0, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(current_row, 1, &row.1, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(current_row, 2, "รายได้", &cell_fmt).map_err(xlsx_error)?;
        sheet.write_number_with_format(current_row, 3, row.3, &num_fmt).map_err(xlsx_error)?;
        total_revenue += row.3;
        current_row += 1;
    }
    sheet.write_string_with_format(current_row, 1, "รวมรายได้", &total_fmt).map_err(xlsx_error)?;
    sheet.write_number_with_format(current_row, 3, total_revenue, &total_fmt).map_err(xlsx_error)?;
    current_row += 2;

    // Expense section
    sheet.merge_range(current_row, 0, current_row, 3, "ค่าใช้จ่าย", &section_fmt).map_err(xlsx_error)?;
    current_row += 1;
    for row in rows.iter().filter(|r| r.2 == "Expense") {
        sheet.write_string_with_format(current_row, 0, &row.0, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(current_row, 1, &row.1, &cell_fmt).map_err(xlsx_error)?;
        sheet.write_string_with_format(current_row, 2, "ค่าใช้จ่าย", &cell_fmt).map_err(xlsx_error)?;
        sheet.write_number_with_format(current_row, 3, row.3, &num_fmt).map_err(xlsx_error)?;
        total_expense += row.3;
        current_row += 1;
    }
    sheet.write_string_with_format(current_row, 1, "รวมค่าใช้จ่าย", &total_fmt).map_err(xlsx_error)?;
    sheet.write_number_with_format(current_row, 3, total_expense, &total_fmt).map_err(xlsx_error)?;
    current_row += 2;

    sheet.write_string_with_format(current_row, 1, "กำไร (ขาดทุน) สุทธิ", &total_fmt).map_err(xlsx_error)?;
    sheet.write_number_with_format(current_row, 3, total_revenue - total_expense, &total_fmt).map_err(xlsx_error)?;

    workbook.save(&save_path).map_err(xlsx_error)?;
    Ok(())
}
