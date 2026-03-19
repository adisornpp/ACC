-- Create companies table (multi-tenant root)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    currency TEXT DEFAULT 'THB',
    fiscal_year_start INTEGER DEFAULT 1,
    vat_registered BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tax_id)
);

-- Create users table with company_id (multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'accountant',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, email)
);

-- Create accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    sub_type TEXT,
    balance_side TEXT CHECK (balance_side IN ('D', 'C')),
    is_active BOOLEAN DEFAULT TRUE,
    parent_account_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    UNIQUE(company_id, account_code),
    CHECK (account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense'))
);

-- Create journals table
CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    journal_code TEXT NOT NULL,
    journal_name TEXT NOT NULL,
    journal_type TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, journal_code)
);

-- Create journal_entries table (header)
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    journal_id TEXT NOT NULL,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    posting_status TEXT DEFAULT 'Draft',
    total_debit REAL DEFAULT 0,
    total_credit REAL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    posted_at DATETIME,
    posted_by TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (posted_by) REFERENCES users(id),
    UNIQUE(company_id, entry_number),
    CHECK (posting_status IN ('Draft', 'Posted', 'Reversed')),
    CHECK (ABS(total_debit - total_credit) < 0.01)
);

-- Create gl_entries table (detail lines)
CREATE TABLE IF NOT EXISTS gl_entries (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    journal_entry_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    description TEXT,
    debit_amount REAL DEFAULT 0,
    credit_amount REAL DEFAULT 0,
    posting_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CHECK ((debit_amount = 0 OR credit_amount = 0) AND (debit_amount > 0 OR credit_amount > 0))
);

-- Create account_balances table (cached monthly balances)
CREATE TABLE IF NOT EXISTS account_balances (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    period_date DATE NOT NULL,
    opening_balance REAL DEFAULT 0,
    debit_total REAL DEFAULT 0,
    credit_total REAL DEFAULT 0,
    closing_balance REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(company_id, account_id, period_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_journals_company ON journals(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(company_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(company_id, posting_status);
CREATE INDEX IF NOT EXISTS idx_gl_entries_company ON gl_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_account ON gl_entries(company_id, account_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_date ON gl_entries(company_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_balances_company_period ON account_balances(company_id, period_date);

-- Thai Chart of Accounts Template (มาตรฐาน)
-- This will be inserted via seed script
CREATE TABLE IF NOT EXISTS coa_templates (
    id TEXT PRIMARY KEY,
    template_name TEXT NOT NULL UNIQUE,
    description TEXT,
    template_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
