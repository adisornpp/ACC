use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

const SS_RATE: f64 = 0.05;       // 5%
const SS_MAX_SALARY: f64 = 15000.0;
const SS_MAX_CONTRIBUTION: f64 = 750.0; // 750 baht/person/month
const SS_MIN_CONTRIBUTION: f64 = 83.0;  // 83 baht minimum

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Employee {
    pub id: String,
    pub company_id: String,
    pub employee_code: String,
    pub full_name: String,
    pub ss_number: Option<String>,
    pub salary: f64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeeInput {
    pub company_id: String,
    pub employee_code: String,
    pub full_name: String,
    pub ss_number: Option<String>,
    pub salary: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsContributionRow {
    pub employee_id: String,
    pub employee_code: String,
    pub full_name: String,
    pub salary: f64,
    pub employee_contribution: f64,
    pub employer_contribution: f64,
    pub total_contribution: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsSummary {
    pub year: i32,
    pub month: i32,
    pub employee_count: i32,
    pub total_salary: f64,
    pub total_employee_contribution: f64,
    pub total_employer_contribution: f64,
    pub total_contribution: f64,
    pub rows: Vec<SsContributionRow>,
}

fn calc_ss(salary: f64) -> f64 {
    let base = salary.min(SS_MAX_SALARY);
    let contribution = base * SS_RATE;
    contribution.max(SS_MIN_CONTRIBUTION).min(SS_MAX_CONTRIBUTION)
}

#[tauri::command]
pub fn get_employees(
    db: State<DbState>,
    company_id: String,
) -> Result<Vec<Employee>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, company_id, employee_code, full_name, ss_number, salary, is_active, created_at
             FROM employees WHERE company_id = ?1 ORDER BY employee_code",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![company_id], |r| {
            Ok(Employee {
                id: r.get(0)?,
                company_id: r.get(1)?,
                employee_code: r.get(2)?,
                full_name: r.get(3)?,
                ss_number: r.get(4)?,
                salary: r.get(5)?,
                is_active: r.get::<_, i32>(6)? != 0,
                created_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn create_employee(
    db: State<DbState>,
    input: CreateEmployeeInput,
) -> Result<Employee, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO employees (id, company_id, employee_code, full_name, ss_number, salary)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            id,
            input.company_id,
            input.employee_code,
            input.full_name,
            input.ss_number,
            input.salary,
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, company_id, employee_code, full_name, ss_number, salary, is_active, created_at
         FROM employees WHERE id = ?1",
        rusqlite::params![id],
        |r| {
            Ok(Employee {
                id: r.get(0)?,
                company_id: r.get(1)?,
                employee_code: r.get(2)?,
                full_name: r.get(3)?,
                ss_number: r.get(4)?,
                salary: r.get(5)?,
                is_active: r.get::<_, i32>(6)? != 0,
                created_at: r.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_employee(
    db: State<DbState>,
    id: String,
    full_name: String,
    ss_number: Option<String>,
    salary: f64,
) -> Result<Employee, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE employees SET full_name = ?2, ss_number = ?3, salary = ?4,
         updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id, full_name, ss_number, salary],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, company_id, employee_code, full_name, ss_number, salary, is_active, created_at
         FROM employees WHERE id = ?1",
        rusqlite::params![id],
        |r| {
            Ok(Employee {
                id: r.get(0)?,
                company_id: r.get(1)?,
                employee_code: r.get(2)?,
                full_name: r.get(3)?,
                ss_number: r.get(4)?,
                salary: r.get(5)?,
                is_active: r.get::<_, i32>(6)? != 0,
                created_at: r.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_employee(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM employees WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn calculate_ss_report(
    db: State<DbState>,
    company_id: String,
    year: i32,
    month: i32,
) -> Result<SsSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, employee_code, full_name, salary
             FROM employees WHERE company_id = ?1 AND is_active = 1
             ORDER BY employee_code",
        )
        .map_err(|e| e.to_string())?;

    let employees: Vec<(String, String, String, f64)> = stmt
        .query_map(rusqlite::params![company_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    let mut total_salary = 0f64;
    let mut total_employee = 0f64;
    let mut total_employer = 0f64;

    for emp in &employees {
        let contribution = calc_ss(emp.3);
        let row = SsContributionRow {
            employee_id: emp.0.clone(),
            employee_code: emp.1.clone(),
            full_name: emp.2.clone(),
            salary: emp.3,
            employee_contribution: contribution,
            employer_contribution: contribution,
            total_contribution: contribution * 2.0,
        };
        total_salary += emp.3;
        total_employee += contribution;
        total_employer += contribution;
        rows.push(row);
    }

    Ok(SsSummary {
        year,
        month,
        employee_count: employees.len() as i32,
        total_salary,
        total_employee_contribution: total_employee,
        total_employer_contribution: total_employer,
        total_contribution: total_employee + total_employer,
        rows,
    })
}

#[tauri::command]
pub fn export_ss_excel(
    db: State<DbState>,
    company_id: String,
    company_name: String,
    year: i32,
    month: i32,
    save_path: String,
) -> Result<(), String> {
    use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Workbook};

    let summary = calculate_ss_report(db, company_id, year, month)?;

    let month_names = [
        "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
        "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
    ];
    let month_name = month_names.get((month - 1) as usize).unwrap_or(&"");

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
    let total_fmt = Format::new().set_bold().set_num_format("#,##0.00").set_border(FormatBorder::Double);

    sheet.merge_range(0, 0, 0, 5, &company_name, &title_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet
        .write_string(1, 0, &format!("ใบนำส่งเงินสมทบประกันสังคม เดือน{} {}", month_name, year + 543))
        .map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;

    let headers = ["ลำดับ", "รหัสพนักงาน", "ชื่อ-สกุล", "เงินเดือน", "ส่วนลูกจ้าง", "ส่วนนายจ้าง"];
    for (i, h) in headers.iter().enumerate() {
        sheet.write_string_with_format(3, i as u16, *h, &header_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    }
    sheet.set_column_width(0, 8).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.set_column_width(1, 14).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.set_column_width(2, 35).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.set_column_width(3, 16).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.set_column_width(4, 16).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.set_column_width(5, 16).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;

    for (i, row) in summary.rows.iter().enumerate() {
        let r = (4 + i) as u32;
        sheet.write_number_with_format(r, 0, (i + 1) as f64, &cell_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
        sheet.write_string_with_format(r, 1, &row.employee_code, &cell_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
        sheet.write_string_with_format(r, 2, &row.full_name, &cell_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
        sheet.write_number_with_format(r, 3, row.salary, &num_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
        sheet.write_number_with_format(r, 4, row.employee_contribution, &num_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
        sheet.write_number_with_format(r, 5, row.employer_contribution, &num_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    }

    let tr = (4 + summary.rows.len()) as u32;
    sheet.write_string_with_format(tr, 2, "รวม", &total_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.write_number_with_format(tr, 3, summary.total_salary, &total_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.write_number_with_format(tr, 4, summary.total_employee_contribution, &total_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    sheet.write_number_with_format(tr, 5, summary.total_employer_contribution, &total_fmt).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;

    workbook.save(&save_path).map_err(|e: rust_xlsxwriter::XlsxError| e.to_string())?;
    Ok(())
}
