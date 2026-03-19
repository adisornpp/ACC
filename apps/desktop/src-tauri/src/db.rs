use rusqlite::{Connection, Result, params};
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tax_id TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            currency TEXT DEFAULT 'THB',
            fiscal_year_start INTEGER DEFAULT 1,
            vat_registered INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'accountant',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, email)
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            account_code TEXT NOT NULL,
            account_name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            sub_type TEXT,
            balance_side TEXT CHECK (balance_side IN ('D', 'C')),
            is_active INTEGER DEFAULT 1,
            parent_account_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, account_code)
        );

        CREATE TABLE IF NOT EXISTS journals (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            journal_code TEXT NOT NULL,
            journal_name TEXT NOT NULL,
            journal_type TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, journal_code)
        );

        CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            journal_id TEXT NOT NULL,
            entry_number TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            description TEXT,
            posting_status TEXT DEFAULT 'Draft',
            total_debit REAL DEFAULT 0,
            total_credit REAL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            posted_at TEXT,
            posted_by TEXT,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, entry_number)
        );

        CREATE TABLE IF NOT EXISTS gl_entries (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            journal_entry_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            line_number INTEGER NOT NULL,
            description TEXT,
            debit_amount REAL DEFAULT 0,
            credit_amount REAL DEFAULT 0,
            posting_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
        CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id, entry_date);
        CREATE INDEX IF NOT EXISTS idx_gl_entries_account ON gl_entries(company_id, account_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    ")?;

    Ok(())
}
