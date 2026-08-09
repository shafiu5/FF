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
  receipt_path: string | null
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

export type Employee = {
  id: string
  name: string
  role: string
  default_vessel_id: string | null
  basic_salary: number
  food_allowance: number
  phone_allowance: number
  active: boolean
  notes: string
  created_at: string
}

export type SalaryRunStatus = 'draft' | 'confirmed'

export type SalaryRun = {
  id: string
  period_month: string
  status: SalaryRunStatus
  confirmed_at: string | null
  created_at: string
}

export type SalarySlip = {
  id: string
  salary_run_id: string
  employee_id: string
  vessel_id: string | null
  basic_salary: number
  food_allowance: number
  phone_allowance: number
  bonus: number
  bonus_notes: string
  expense_id: string | null
  created_at: string
}

export type SalarySlipTrip = {
  id: string
  salary_slip_id: string
  trip_date: string
  description: string
  amount: number
  created_at: string
}
