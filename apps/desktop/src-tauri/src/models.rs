use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub id: String,
    pub name: String,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub currency: String,
    pub fiscal_year_start: i32,
    pub vat_registered: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCompanyInput {
    pub name: String,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub currency: Option<String>,
    pub fiscal_year_start: Option<i32>,
    pub vat_registered: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub company_id: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub email: String,
    pub password: String,
    pub company_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub company_id: String,
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub sub_type: Option<String>,
    pub balance_side: String,
    pub is_active: bool,
    pub parent_account_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountInput {
    pub company_id: String,
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub sub_type: Option<String>,
    pub balance_side: String,
    pub parent_account_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountInput {
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub account_type: Option<String>,
    pub sub_type: Option<String>,
    pub balance_side: Option<String>,
    pub is_active: Option<bool>,
    pub parent_account_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Journal {
    pub id: String,
    pub company_id: String,
    pub journal_code: String,
    pub journal_name: String,
    pub journal_type: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    pub company_id: String,
    pub journal_id: String,
    pub entry_number: String,
    pub entry_date: String,
    pub description: Option<String>,
    pub posting_status: String,
    pub total_debit: f64,
    pub total_credit: f64,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub posted_at: Option<String>,
    pub posted_by: Option<String>,
    pub lines: Option<Vec<GlEntry>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJournalEntryInput {
    pub company_id: String,
    pub journal_id: String,
    pub entry_date: String,
    pub description: Option<String>,
    pub lines: Vec<CreateGlEntryInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GlEntry {
    pub id: String,
    pub company_id: String,
    pub journal_entry_id: String,
    pub account_id: String,
    pub line_number: i32,
    pub description: Option<String>,
    pub debit_amount: f64,
    pub credit_amount: f64,
    pub posting_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGlEntryInput {
    pub account_id: String,
    pub description: Option<String>,
    pub debit_amount: f64,
    pub credit_amount: f64,
}

// Reports
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialBalanceRow {
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub debit: f64,
    pub credit: f64,
}
