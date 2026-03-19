#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;

use db::{DbState, init_db};
use rusqlite::Connection;
use std::sync::Mutex;

fn main() {
    let db_path = dirs::data_dir()
        .map(|p| p.join("accounting-app").join("accounting.db"))
        .unwrap_or_else(|| std::path::PathBuf::from("accounting.db"));

    // Ensure directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_current_user,
            commands::auth::create_admin_user,
            // Companies
            commands::companies::get_companies,
            commands::companies::create_company,
            commands::companies::update_company,
            commands::companies::delete_company,
            // Accounts (Chart of Accounts)
            commands::accounts::get_accounts,
            commands::accounts::create_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            commands::accounts::seed_thai_coa,
            // Journal Entries
            commands::entries::get_journals,
            commands::entries::get_journal_entries,
            commands::entries::create_journal_entry,
            commands::entries::post_journal_entry,
            commands::entries::get_gl_entries,
            // Reports
            commands::reports::get_trial_balance,
            commands::reports::get_balance_sheet,
            commands::reports::get_income_statement,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
