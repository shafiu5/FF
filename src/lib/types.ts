export type Vessel = {
  id: string
  name: string
  notes: string
  created_at: string
}

export type FuelEntryCost = {
  id: string
  vessel_id: string
  location_id: string
  filled_at: string
  quantity: number
  unit_cost: number | null
  cost: number | null
  notes: string
}

export const EXPENSE_CATEGORY_SUGGESTIONS = [
  'Maintenance',
  'Crew Wages',
  'Port Fees',
  'Insurance',
  'Provisions',
  'Repairs',
  'Other',
] as const

export type Expense = {
  id: string
  vessel_id: string | null
  category: string
  amount: number
  has_tax: boolean
  tax_percent: number | null
  tax_amount: number | null
  expense_date: string
  vendor: string
  notes: string
  created_at: string
}

export type AppSettings = {
  tax_percent: number
}

export type IncomeSource = 'manual' | 'import'

export type IncomeEntry = {
  id: string
  vessel_id: string | null
  amount: number
  income_date: string
  reference: string
  description: string
  is_tax_free: boolean
  source: IncomeSource
  import_batch_id: string | null
  created_at: string
}

export type IncomeEntryLine = {
  id: string
  income_entry_id: string
  name: string
  amount: number
  reference: string
  is_tax_free: boolean
  created_at: string
}

export type OmitRule = {
  id: string
  reference: string
  contact: string
  label: string
  created_at: string
}
