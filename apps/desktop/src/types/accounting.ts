// Company
export interface Company {
  id: string
  name: string
  taxId?: string
  address?: string
  phone?: string
  email?: string
  currency: string
  fiscalYearStart: number
  vatRegistered: boolean
  createdAt: string
  updatedAt: string
}

// User
export interface User {
  id: string
  companyId: string
  email: string
  fullName: string
  role: 'admin' | 'manager' | 'accountant' | 'viewer'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Account (Chart of Accounts)
export interface Account {
  id: string
  companyId: string
  accountCode: string
  accountName: string
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  subType?: string
  balanceSide: 'D' | 'C'
  isActive: boolean
  parentAccountId?: string
  createdAt: string
  updatedAt: string
}

// Journal
export interface Journal {
  id: string
  companyId: string
  journalCode: string
  journalName: string
  journalType?: 'General' | 'Sales' | 'Purchase' | 'Bank' | 'Cash'
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Journal Entry (Header)
export interface JournalEntry {
  id: string
  companyId: string
  journalId: string
  entryNumber: string
  entryDate: string
  description?: string
  postingStatus: 'Draft' | 'Posted' | 'Reversed'
  totalDebit: number
  totalCredit: number
  createdBy: string
  createdAt: string
  updatedAt: string
  postedAt?: string
  postedBy?: string
  lines?: GLEntry[]
}

// GL Entry (Detail Lines)
export interface GLEntry {
  id: string
  companyId: string
  journalEntryId: string
  accountId: string
  lineNumber: number
  description?: string
  debitAmount: number
  creditAmount: number
  postingDate?: string
  createdAt: string
  account?: Account
}

// Account Balance
export interface AccountBalance {
  id: string
  companyId: string
  accountId: string
  periodDate: string
  openingBalance: number
  debitTotal: number
  creditTotal: number
  closingBalance: number
  updatedAt: string
}

// Financial Reports
export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  debit: number
  credit: number
  total: number
}

export interface BalanceSheetItem {
  code: string
  name: string
  amount: number
  level: number
}

export interface IncomeStatementItem {
  code: string
  name: string
  amount: number
  level: number
}

export interface FinancialReportRequest {
  companyId: string
  asOfDate: string
  compareYear?: boolean
}

// Accounting Constants
export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const
export const POSTING_STATUS = ['Draft', 'Posted', 'Reversed'] as const
export const USER_ROLES = ['admin', 'manager', 'accountant', 'viewer'] as const
export const BALANCE_SIDE = ['D', 'C'] as const

// Validation Rules
export interface ValidationError {
  field: string
  message: string
}

// Double-Entry Validation
export interface DoubleEntryValidation {
  isValid: boolean
  totalDebit: number
  totalCredit: number
  difference: number
}
