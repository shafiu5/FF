'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, X, Trash2, Pencil, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import type {
  Employee,
  SalaryRun,
  SalarySlip,
  SalarySlipTrip,
  SalarySlipDeduction,
  EmployeeLoan,
  LoanBalance,
} from '@/lib/types'

type VesselOption = { id: string; name: string }
type View = 'employees' | 'runs' | 'run' | 'loans'

function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function lastDayOfMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number)
  const last = new Date(y, m, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

const tabButtonClass = (active: boolean) =>
  `flex-1 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
      : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
  }`

export default function SalaryPanel() {
  const supabase = createClient()
  const [view, setView] = useState<View>('runs')

  const [vessels, setVessels] = useState<VesselOption[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [runs, setRuns] = useState<SalaryRun[]>([])
  const [loans, setLoans] = useState<EmployeeLoan[]>([])
  const [loanBalances, setLoanBalances] = useState<LoanBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, employeesRes, runsRes, loansRes, loanBalancesRes] = await Promise.all([
        supabase.from('vessels').select('id, name').order('name'),
        supabase.from('employees').select('*').order('name'),
        supabase.from('salary_runs').select('*').order('period_month', { ascending: false }),
        supabase.from('employee_loans').select('*').order('created_at', { ascending: false }),
        supabase.from('loan_balances').select('*'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (employeesRes.error) throw employeesRes.error
      if (runsRes.error) throw runsRes.error
      if (loansRes.error) throw loansRes.error
      if (loanBalancesRes.error) throw loanBalancesRes.error
      setVessels((vesselsRes.data as VesselOption[]) ?? [])
      setEmployees((employeesRes.data as Employee[]) ?? [])
      setRuns((runsRes.data as SalaryRun[]) ?? [])
      setLoans((loansRes.data as EmployeeLoan[]) ?? [])
      setLoanBalances((loanBalancesRes.data as LoanBalance[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load salary data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ---------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [empName, setEmpName] = useState('')
  const [empRole, setEmpRole] = useState('')
  const [empVesselId, setEmpVesselId] = useState('')
  const [empBasic, setEmpBasic] = useState('')
  const [empFood, setEmpFood] = useState('')
  const [empPhone, setEmpPhone] = useState('')
  const [empActive, setEmpActive] = useState(true)
  const [empNotes, setEmpNotes] = useState('')
  const [savingEmployee, setSavingEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null)
  const [employeeListError, setEmployeeListError] = useState<string | null>(null)

  const employeesBySalaryDesc = useMemo(
    () =>
      [...employees].sort(
        (a, b) =>
          b.basic_salary + b.food_allowance + b.phone_allowance -
          (a.basic_salary + a.food_allowance + a.phone_allowance)
      ),
    [employees]
  )

  function resetEmployeeForm() {
    setEmpName('')
    setEmpRole('')
    setEmpVesselId('')
    setEmpBasic('')
    setEmpFood('')
    setEmpPhone('')
    setEmpActive(true)
    setEmpNotes('')
  }

  function startAddEmployee() {
    resetEmployeeForm()
    setEditingEmployeeId(null)
    setEmployeeError(null)
    setShowAddEmployee(true)
  }

  function startEditEmployee(emp: Employee) {
    setEmpName(emp.name)
    setEmpRole(emp.role)
    setEmpVesselId(emp.default_vessel_id ?? '')
    setEmpBasic(String(emp.basic_salary))
    setEmpFood(String(emp.food_allowance))
    setEmpPhone(String(emp.phone_allowance))
    setEmpActive(emp.active)
    setEmpNotes(emp.notes)
    setEditingEmployeeId(emp.id)
    setEmployeeError(null)
    setShowAddEmployee(true)
  }

  async function saveEmployee(e: FormEvent) {
    e.preventDefault()
    setSavingEmployee(true)
    setEmployeeError(null)
    const payload = {
      name: empName.trim(),
      role: empRole.trim(),
      default_vessel_id: empVesselId || null,
      basic_salary: Number(empBasic) || 0,
      food_allowance: Number(empFood) || 0,
      phone_allowance: Number(empPhone) || 0,
      active: empActive,
      notes: empNotes,
    }
    const { error } = editingEmployeeId
      ? await supabase.from('employees').update(payload).eq('id', editingEmployeeId)
      : await supabase.from('employees').insert(payload)
    setSavingEmployee(false)
    if (error) {
      setEmployeeError(error.message)
      return
    }
    setShowAddEmployee(false)
    setEditingEmployeeId(null)
    resetEmployeeForm()
    loadAll()
  }

  async function deleteEmployee(id: string) {
    setDeletingEmployeeId(id)
    setEmployeeListError(null)
    const { error } = await supabase.from('employees').delete().eq('id', id)
    setDeletingEmployeeId(null)
    if (error) {
      setEmployeeListError(
        error.message.toLowerCase().includes('foreign key')
          ? 'This employee has salary history, so they can’t be deleted — edit them and untick Active instead.'
          : error.message
      )
      return
    }
    loadAll()
  }

  // ---------------------------------------------------------------------
  // Loans
  // ---------------------------------------------------------------------
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [loanEmployeeId, setLoanEmployeeId] = useState('')
  const [loanPrincipal, setLoanPrincipal] = useState('')
  const [loanInstallment, setLoanInstallment] = useState('')
  const [loanNotes, setLoanNotes] = useState('')
  const [loanStatus, setLoanStatus] = useState<'active' | 'closed'>('active')
  const [savingLoan, setSavingLoan] = useState(false)
  const [loanError, setLoanError] = useState<string | null>(null)
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null)
  const [loanListError, setLoanListError] = useState<string | null>(null)

  function resetLoanForm() {
    setLoanEmployeeId('')
    setLoanPrincipal('')
    setLoanInstallment('')
    setLoanNotes('')
    setLoanStatus('active')
  }

  function startAddLoan() {
    resetLoanForm()
    setEditingLoanId(null)
    setLoanError(null)
    setShowAddLoan(true)
  }

  function startEditLoan(loan: EmployeeLoan) {
    setLoanEmployeeId(loan.employee_id)
    setLoanPrincipal(String(loan.principal_amount))
    setLoanInstallment(String(loan.monthly_installment))
    setLoanNotes(loan.notes)
    setLoanStatus(loan.status)
    setEditingLoanId(loan.id)
    setLoanError(null)
    setShowAddLoan(true)
  }

  async function saveLoan(e: FormEvent) {
    e.preventDefault()
    setSavingLoan(true)
    setLoanError(null)
    const payload = {
      employee_id: loanEmployeeId,
      principal_amount: Number(loanPrincipal) || 0,
      monthly_installment: Number(loanInstallment) || 0,
      notes: loanNotes,
      status: loanStatus,
    }
    const { error } = editingLoanId
      ? await supabase.from('employee_loans').update(payload).eq('id', editingLoanId)
      : await supabase.from('employee_loans').insert(payload)
    setSavingLoan(false)
    if (error) {
      setLoanError(error.message)
      return
    }
    setShowAddLoan(false)
    setEditingLoanId(null)
    resetLoanForm()
    loadAll()
  }

  async function deleteLoan(id: string) {
    setDeletingLoanId(id)
    setLoanListError(null)
    const { error } = await supabase.from('employee_loans').delete().eq('id', id)
    setDeletingLoanId(null)
    if (error) {
      setLoanListError(error.message)
      return
    }
    loadAll()
  }

  // ---------------------------------------------------------------------
  // Runs
  // ---------------------------------------------------------------------
  const [newRunMonth, setNewRunMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [creatingRun, setCreatingRun] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  function openRun(id: string) {
    setSelectedRunId(id)
    setView('run')
  }

  async function createRun() {
    setCreatingRun(true)
    setRunsError(null)
    const periodMonth = `${newRunMonth}-01`
    const existing = runs.find((r) => r.period_month === periodMonth)
    if (existing) {
      setCreatingRun(false)
      openRun(existing.id)
      return
    }
    const { data: run, error } = await supabase
      .from('salary_runs')
      .insert({ period_month: periodMonth })
      .select('id')
      .single()
    if (error || !run) {
      setCreatingRun(false)
      if (error?.message.includes('salary_runs_period_month_key')) {
        setRunsError('A run already exists for this month — opening it instead.')
        const { data: found } = await supabase
          .from('salary_runs')
          .select('id')
          .eq('period_month', periodMonth)
          .single()
        await loadAll()
        if (found) openRun(found.id)
      } else {
        setRunsError(error?.message ?? 'Failed to create the run.')
      }
      return
    }
    const activeEmployees = employees.filter((e) => e.active)
    if (activeEmployees.length > 0) {
      const slipsPayload = activeEmployees.map((emp) => ({
        salary_run_id: run.id,
        employee_id: emp.id,
        vessel_id: emp.default_vessel_id,
        basic_salary: emp.basic_salary,
        food_allowance: emp.food_allowance,
        phone_allowance: emp.phone_allowance,
      }))
      const { data: newSlips, error: slipsError } = await supabase
        .from('salary_slips')
        .insert(slipsPayload)
        .select('id, employee_id')
      if (slipsError) {
        // Don't leave an empty orphaned run behind if the slips failed.
        await supabase.from('salary_runs').delete().eq('id', run.id)
        setCreatingRun(false)
        setRunsError(`Couldn't create the employee slips, so nothing was created: ${slipsError.message}`)
        return
      }

      // Auto-add this month's installment for any employee with an active
      // loan still owing a balance, capped so it never overshoots what's
      // left. Skipping a month for someone is just deleting this row from
      // their slip before confirming.
      const loanDeductionsPayload = (newSlips ?? []).flatMap((slip) => {
        const loan = loans.find((l) => l.employee_id === slip.employee_id && l.status === 'active')
        if (!loan) return []
        const balance = loanBalances.find((b) => b.loan_id === loan.id)
        const remaining = balance ? balance.remaining_amount : loan.principal_amount
        if (remaining <= 0) return []
        const amount = Math.min(loan.monthly_installment, remaining)
        if (amount <= 0) return []
        return [
          {
            salary_slip_id: slip.id,
            deduction_date: periodMonth,
            description: 'Loan repayment',
            amount,
            loan_id: loan.id,
          },
        ]
      })
      if (loanDeductionsPayload.length > 0) {
        const { error: loanDeductionsError } = await supabase
          .from('salary_slip_deductions')
          .insert(loanDeductionsPayload)
        if (loanDeductionsError) {
          setRunsError(
            `Run created, but couldn't auto-add loan installments: ${loanDeductionsError.message}. You can add them manually on each slip.`
          )
        }
      }
    }
    setCreatingRun(false)
    await loadAll()
    openRun(run.id)
  }

  // ---------------------------------------------------------------------
  // Run detail
  // ---------------------------------------------------------------------
  const [runSlips, setRunSlips] = useState<SalarySlip[]>([])
  const [runTrips, setRunTrips] = useState<Record<string, SalarySlipTrip[]>>({})
  const [runDeductions, setRunDeductions] = useState<Record<string, SalarySlipDeduction[]>>({})
  const [loadingRun, setLoadingRun] = useState(false)
  const [runDetailError, setRunDetailError] = useState<string | null>(null)

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null

  async function loadRunDetail(runId: string) {
    setLoadingRun(true)
    setRunDetailError(null)
    try {
      const slipsRes = await supabase
        .from('salary_slips')
        .select('*')
        .eq('salary_run_id', runId)
        .order('created_at')
      if (slipsRes.error) throw slipsRes.error
      const slipsData = (slipsRes.data as SalarySlip[]) ?? []
      setRunSlips(slipsData)
      if (slipsData.length > 0) {
        const slipIds = slipsData.map((s) => s.id)
        const [tripsRes, deductionsRes] = await Promise.all([
          supabase.from('salary_slip_trips').select('*').in('salary_slip_id', slipIds).order('trip_date'),
          supabase
            .from('salary_slip_deductions')
            .select('*')
            .in('salary_slip_id', slipIds)
            .order('deduction_date'),
        ])
        if (tripsRes.error) throw tripsRes.error
        if (deductionsRes.error) throw deductionsRes.error
        const groupedTrips: Record<string, SalarySlipTrip[]> = {}
        for (const t of (tripsRes.data as SalarySlipTrip[]) ?? []) {
          ;(groupedTrips[t.salary_slip_id] ??= []).push(t)
        }
        setRunTrips(groupedTrips)
        const groupedDeductions: Record<string, SalarySlipDeduction[]> = {}
        for (const d of (deductionsRes.data as SalarySlipDeduction[]) ?? []) {
          ;(groupedDeductions[d.salary_slip_id] ??= []).push(d)
        }
        setRunDeductions(groupedDeductions)
      } else {
        setRunTrips({})
        setRunDeductions({})
      }
    } catch (err) {
      setRunDetailError(err instanceof Error ? err.message : 'Failed to load this run.')
    } finally {
      setLoadingRun(false)
    }
  }

  useEffect(() => {
    if (view === 'run' && selectedRunId) loadRunDetail(selectedRunId)
  }, [view, selectedRunId])

  function slipTotal(slip: SalarySlip): number {
    const tripsTotal = (runTrips[slip.id] ?? []).reduce((s, t) => s + t.amount, 0)
    const deductionsTotal = (runDeductions[slip.id] ?? []).reduce((s, d) => s + d.amount, 0)
    return slip.basic_salary + slip.food_allowance + slip.phone_allowance + slip.bonus + tripsTotal - deductionsTotal
  }

  const runTotal = useMemo(
    () => runSlips.reduce((s, slip) => s + slipTotal(slip), 0),
    [runSlips, runTrips, runDeductions]
  )

  // -- expand/edit a slip --
  const [expandedSlipId, setExpandedSlipId] = useState<string | null>(null)
  const [slipEditVesselId, setSlipEditVesselId] = useState('')
  const [slipEditBasic, setSlipEditBasic] = useState('')
  const [slipEditFood, setSlipEditFood] = useState('')
  const [slipEditPhone, setSlipEditPhone] = useState('')
  const [slipEditBonus, setSlipEditBonus] = useState('')
  const [slipEditBonusNotes, setSlipEditBonusNotes] = useState('')
  const [savingSlip, setSavingSlip] = useState(false)
  const [slipError, setSlipError] = useState<string | null>(null)

  const [newTripDate, setNewTripDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newTripDescription, setNewTripDescription] = useState('')
  const [newTripAmount, setNewTripAmount] = useState('')
  const [addingTrip, setAddingTrip] = useState(false)

  const [newDeductionDate, setNewDeductionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newDeductionDescription, setNewDeductionDescription] = useState('')
  const [newDeductionAmount, setNewDeductionAmount] = useState('')
  const [addingDeduction, setAddingDeduction] = useState(false)

  function toggleSlip(slip: SalarySlip) {
    if (expandedSlipId === slip.id) {
      setExpandedSlipId(null)
      return
    }
    setExpandedSlipId(slip.id)
    setSlipEditVesselId(slip.vessel_id ?? '')
    setSlipEditBasic(String(slip.basic_salary))
    setSlipEditFood(String(slip.food_allowance))
    setSlipEditPhone(String(slip.phone_allowance))
    setSlipEditBonus(String(slip.bonus))
    setSlipEditBonusNotes(slip.bonus_notes)
    setSlipError(null)
    setNewTripDescription('')
    setNewTripAmount('')
    setNewDeductionDescription('')
    setNewDeductionAmount('')
  }

  async function saveSlip(slipId: string) {
    setSavingSlip(true)
    setSlipError(null)
    const { error } = await supabase
      .from('salary_slips')
      .update({
        vessel_id: slipEditVesselId || null,
        basic_salary: Number(slipEditBasic) || 0,
        food_allowance: Number(slipEditFood) || 0,
        phone_allowance: Number(slipEditPhone) || 0,
        bonus: Number(slipEditBonus) || 0,
        bonus_notes: slipEditBonusNotes,
      })
      .eq('id', slipId)
    setSavingSlip(false)
    if (error) {
      setSlipError(error.message)
      return
    }
    if (selectedRunId) loadRunDetail(selectedRunId)
  }

  async function addTrip(slipId: string) {
    if (!newTripAmount) return
    setAddingTrip(true)
    setSlipError(null)
    const { error } = await supabase.from('salary_slip_trips').insert({
      salary_slip_id: slipId,
      trip_date: newTripDate,
      description: newTripDescription,
      amount: Number(newTripAmount) || 0,
    })
    setAddingTrip(false)
    if (error) {
      setSlipError(error.message)
      return
    }
    setNewTripDescription('')
    setNewTripAmount('')
    if (selectedRunId) loadRunDetail(selectedRunId)
  }

  async function removeTrip(tripId: string) {
    await supabase.from('salary_slip_trips').delete().eq('id', tripId)
    if (selectedRunId) loadRunDetail(selectedRunId)
  }

  async function addDeduction(slipId: string) {
    if (!newDeductionAmount) return
    setAddingDeduction(true)
    setSlipError(null)
    const { error } = await supabase.from('salary_slip_deductions').insert({
      salary_slip_id: slipId,
      deduction_date: newDeductionDate,
      description: newDeductionDescription,
      amount: Number(newDeductionAmount) || 0,
    })
    setAddingDeduction(false)
    if (error) {
      setSlipError(error.message)
      return
    }
    setNewDeductionDescription('')
    setNewDeductionAmount('')
    if (selectedRunId) loadRunDetail(selectedRunId)
  }

  async function removeDeduction(deductionId: string) {
    await supabase.from('salary_slip_deductions').delete().eq('id', deductionId)
    if (selectedRunId) loadRunDetail(selectedRunId)
  }

  // -- confirm run --
  const [payDate, setPayDate] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedRun) setPayDate(lastDayOfMonth(selectedRun.period_month))
    setConfirmChecked(false)
    setConfirmError(null)
  }, [selectedRun?.id])

  function buildSlipNotes(slip: SalarySlip, trips: SalarySlipTrip[], deductions: SalarySlipDeduction[]): string {
    const parts = [`Basic ${formatMVR(slip.basic_salary)}`]
    if (slip.food_allowance > 0) parts.push(`Food ${formatMVR(slip.food_allowance)}`)
    if (slip.phone_allowance > 0) parts.push(`Phone ${formatMVR(slip.phone_allowance)}`)
    if (slip.bonus > 0) parts.push(`Bonus ${formatMVR(slip.bonus)}${slip.bonus_notes ? ` (${slip.bonus_notes})` : ''}`)
    if (trips.length > 0) {
      const tripsTotal = trips.reduce((s, t) => s + t.amount, 0)
      const tripLabels = trips.map((t) => t.description || t.trip_date).join(', ')
      parts.push(`Trips ${formatMVR(tripsTotal)} (${tripLabels})`)
    }
    if (deductions.length > 0) {
      const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0)
      const deductionLabels = deductions.map((d) => d.description || d.deduction_date).join(', ')
      parts.push(`Deductions -${formatMVR(deductionsTotal)} (${deductionLabels})`)
    }
    return `Salary for ${selectedRun ? monthLabel(selectedRun.period_month) : ''}: ${parts.join(', ')}`
  }

  async function confirmRun() {
    if (!selectedRun) return
    setConfirming(true)
    setConfirmError(null)
    const insertedExpenseIds: string[] = []
    try {
      for (const slip of runSlips) {
        const employee = employees.find((e) => e.id === slip.employee_id)
        const trips = runTrips[slip.id] ?? []
        const deductions = runDeductions[slip.id] ?? []
        const { data: expense, error } = await supabase
          .from('expenses')
          .insert({
            vessel_id: slip.vessel_id,
            category: 'Salary',
            amount: slipTotal(slip),
            has_tax: false,
            tax_percent: null,
            tax_amount: null,
            expense_date: payDate,
            vendor: employee?.name ?? 'Employee',
            notes: buildSlipNotes(slip, trips, deductions),
          })
          .select('id')
          .single()
        if (error || !expense) throw new Error(error?.message ?? 'Failed to create an expense.')
        insertedExpenseIds.push(expense.id)
        const { error: linkError } = await supabase
          .from('salary_slips')
          .update({ expense_id: expense.id })
          .eq('id', slip.id)
        if (linkError) throw new Error(linkError.message)
      }
      const { error: runError } = await supabase
        .from('salary_runs')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', selectedRun.id)
      if (runError) throw new Error(runError.message)
      setConfirming(false)
      setConfirmChecked(false)
      await loadRunDetail(selectedRun.id)
      await loadAll()
    } catch (err) {
      // Don't leave the run half-confirmed with some slips linked to
      // expenses and others not — undo everything from this attempt.
      if (insertedExpenseIds.length > 0) {
        await supabase.from('expenses').delete().in('id', insertedExpenseIds)
      }
      setConfirming(false)
      setConfirmError(err instanceof Error ? err.message : 'Failed to confirm this run.')
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (loading) {
    return <p className="text-gray-400 dark:text-gray-500">Loading…</p>
  }
  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        <button
          onClick={loadAll}
          className="text-sm font-medium text-sky-600 dark:text-sky-400 transition-colors hover:text-sky-700 dark:hover:text-sky-300"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {view !== 'run' && (
        <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
          <button type="button" onClick={() => setView('runs')} className={tabButtonClass(view === 'runs')}>
            Runs
          </button>
          <button type="button" onClick={() => setView('employees')} className={tabButtonClass(view === 'employees')}>
            Employees
          </button>
          <button type="button" onClick={() => setView('loans')} className={tabButtonClass(view === 'loans')}>
            Loans
          </button>
        </div>
      )}

      {view === 'employees' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Employees</h2>
            <button
              onClick={() => (showAddEmployee ? setShowAddEmployee(false) : startAddEmployee())}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800"
            >
              {showAddEmployee ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
              {showAddEmployee ? 'Cancel' : 'Add employee'}
            </button>
          </div>

          {showAddEmployee && (
            <form
              onSubmit={saveEmployee}
              className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
            >
              <input
                required
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
              <input
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
                placeholder="Role (optional)"
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
              <select
                value={empVesselId}
                onChange={(e) => setEmpVesselId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              >
                <option value="">Unassigned (fleet-wide)</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={empBasic}
                  onChange={(e) => setEmpBasic(e.target.value)}
                  placeholder="Basic salary"
                  className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={empFood}
                  onChange={(e) => setEmpFood(e.target.value)}
                  placeholder="Food allowance"
                  className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  placeholder="Phone allowance"
                  className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                />
              </div>
              <textarea
                value={empNotes}
                onChange={(e) => setEmpNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={empActive}
                  onChange={(e) => setEmpActive(e.target.checked)}
                  className="rounded border-gray-300 dark:border-neutral-700"
                />
                Active (included in new salary runs)
              </label>
              {employeeError && <p className="text-sm text-red-600 dark:text-red-400">{employeeError}</p>}
              <button
                disabled={savingEmployee}
                className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
              >
                {savingEmployee ? 'Saving…' : editingEmployeeId ? 'Save changes' : 'Add employee'}
              </button>
            </form>
          )}

          {employeeListError && <p className="text-sm text-red-600 dark:text-red-400">{employeeListError}</p>}

          {employees.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No employees yet.</p>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
              {employeesBySalaryDesc.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between px-4 py-3 text-sm gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                >
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-1.5 flex-wrap">
                      {emp.name}
                      {emp.role && <span className="text-gray-400 dark:text-gray-500 font-normal"> · {emp.role}</span>}
                      {!emp.active && (
                        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-0.5">
                          Inactive
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {vessels.find((v) => v.id === emp.default_vessel_id)?.name ?? 'Unassigned'} ·{' '}
                      {formatMVR(emp.basic_salary + emp.food_allowance + emp.phone_allowance)} salary
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEditEmployee(emp)}
                      className="text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-950/50"
                      aria-label="Edit"
                    >
                      <Pencil size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      disabled={deletingEmployeeId === emp.id}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'loans' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Loans</h2>
            <button
              onClick={() => (showAddLoan ? setShowAddLoan(false) : startAddLoan())}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800"
            >
              {showAddLoan ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
              {showAddLoan ? 'Cancel' : 'Add loan'}
            </button>
          </div>

          {showAddLoan && (
            <form
              onSubmit={saveLoan}
              className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
            >
              <select
                required
                value={loanEmployeeId}
                onChange={(e) => setLoanEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={loanPrincipal}
                  onChange={(e) => setLoanPrincipal(e.target.value)}
                  placeholder="Principal amount"
                  className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={loanInstallment}
                  onChange={(e) => setLoanInstallment(e.target.value)}
                  placeholder="Monthly installment"
                  className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                />
              </div>
              <textarea
                value={loanNotes}
                onChange={(e) => setLoanNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
              {editingLoanId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={loanStatus === 'active'}
                    onChange={(e) => setLoanStatus(e.target.checked ? 'active' : 'closed')}
                    className="rounded border-gray-300 dark:border-neutral-700"
                  />
                  Active (auto-deducted on new salary runs)
                </label>
              )}
              {loanError && <p className="text-sm text-red-600 dark:text-red-400">{loanError}</p>}
              <button
                disabled={savingLoan}
                className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
              >
                {savingLoan ? 'Saving…' : editingLoanId ? 'Save changes' : 'Add loan'}
              </button>
            </form>
          )}

          {loanListError && <p className="text-sm text-red-600 dark:text-red-400">{loanListError}</p>}

          {loans.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No loans yet.</p>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
              {loans.map((loan) => {
                const employee = employees.find((e) => e.id === loan.employee_id)
                const balance = loanBalances.find((b) => b.loan_id === loan.id)
                const remaining = balance ? balance.remaining_amount : loan.principal_amount
                const paidOff = remaining <= 0
                return (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between px-4 py-3 text-sm gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                  >
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-1.5 flex-wrap">
                        {employee?.name ?? 'Employee'}
                        <span
                          className={`text-xs font-normal rounded px-1.5 py-0.5 border ${
                            paidOff
                              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                              : loan.status === 'active'
                                ? 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-neutral-700'
                                : 'text-gray-400 dark:text-gray-500 border-gray-300 dark:border-neutral-700'
                          }`}
                        >
                          {paidOff ? 'Paid off' : loan.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {formatMVR(Math.max(remaining, 0))} remaining of {formatMVR(loan.principal_amount)} ·{' '}
                        {formatMVR(loan.monthly_installment)}/month
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => startEditLoan(loan)}
                        className="text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-950/50"
                        aria-label="Edit"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => deleteLoan(loan.id)}
                        disabled={deletingLoanId === loan.id}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {view === 'runs' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">New salary run</p>
            <div className="flex gap-2">
              <input
                type="month"
                value={newRunMonth}
                onChange={(e) => setNewRunMonth(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <button
                onClick={createRun}
                disabled={creatingRun}
                className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50"
              >
                {creatingRun ? 'Creating…' : '+ New run'}
              </button>
            </div>
            {runsError && <p className="text-sm text-red-600 dark:text-red-400">{runsError}</p>}
          </div>

          {runs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No salary runs yet.</p>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => openRun(run.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60 active:bg-gray-100 dark:active:bg-neutral-800"
                >
                  <span>
                    <p className="font-medium flex items-center gap-1.5">
                      {monthLabel(run.period_month)}
                      <span
                        className={`text-xs font-normal rounded px-1.5 py-0.5 border ${
                          run.status === 'confirmed'
                            ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-neutral-700'
                        }`}
                      >
                        {run.status === 'confirmed' ? 'Confirmed' : 'Draft'}
                      </span>
                    </p>
                  </span>
                  <ChevronRight size={16} strokeWidth={1.75} className="text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'run' && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setView('runs')
              setSelectedRunId(null)
            }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
            Runs
          </button>

          {loadingRun ? (
            <p className="text-gray-400 dark:text-gray-500">Loading…</p>
          ) : runDetailError ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{runDetailError}</p>
            </div>
          ) : (
            selectedRun && (
              <>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {monthLabel(selectedRun.period_month)}
                    <span
                      className={`text-xs font-normal rounded px-1.5 py-0.5 border ${
                        selectedRun.status === 'confirmed'
                          ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                          : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-neutral-700'
                      }`}
                    >
                      {selectedRun.status === 'confirmed' ? 'Confirmed' : 'Draft'}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {runSlips.length} {runSlips.length === 1 ? 'employee' : 'employees'} · Total{' '}
                    {formatMVR(runTotal)}
                  </p>
                </div>

                {runSlips.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    No active employees when this run was created.
                  </p>
                ) : (
                  <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                    {runSlips.map((slip) => {
                      const employee = employees.find((e) => e.id === slip.employee_id)
                      const trips = runTrips[slip.id] ?? []
                      const deductions = runDeductions[slip.id] ?? []
                      const total = slipTotal(slip)
                      const expanded = expandedSlipId === slip.id
                      const isDraft = selectedRun.status === 'draft'
                      return (
                        <div key={slip.id}>
                          <button
                            type="button"
                            onClick={() => toggleSlip(slip)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {expanded ? (
                                <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                              ) : (
                                <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                              )}
                              <span className="min-w-0">
                                <p className="font-medium truncate">{employee?.name ?? 'Employee'}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {vessels.find((v) => v.id === slip.vessel_id)?.name ?? 'Unassigned'}
                                  {trips.length > 0 && ` · ${trips.length} trip${trips.length === 1 ? '' : 's'}`}
                                  {deductions.length > 0 &&
                                    ` · ${deductions.length} deduction${deductions.length === 1 ? '' : 's'}`}
                                </p>
                              </span>
                            </span>
                            <span className="font-medium shrink-0">{formatMVR(total)}</span>
                          </button>
                          {expanded && (
                            <div className="px-4 pb-4 pl-10 space-y-3">
                              {isDraft ? (
                                <>
                                  <select
                                    value={slipEditVesselId}
                                    onChange={(e) => setSlipEditVesselId(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                  >
                                    <option value="">Unassigned (fleet-wide)</option>
                                    {vessels.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="grid grid-cols-3 gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={slipEditBasic}
                                      onChange={(e) => setSlipEditBasic(e.target.value)}
                                      placeholder="Basic"
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={slipEditFood}
                                      onChange={(e) => setSlipEditFood(e.target.value)}
                                      placeholder="Food"
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={slipEditPhone}
                                      onChange={(e) => setSlipEditPhone(e.target.value)}
                                      placeholder="Phone"
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={slipEditBonus}
                                      onChange={(e) => setSlipEditBonus(e.target.value)}
                                      placeholder="Bonus"
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                    />
                                    <input
                                      value={slipEditBonusNotes}
                                      onChange={(e) => setSlipEditBonusNotes(e.target.value)}
                                      placeholder="Bonus note (optional)"
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  {slipError && <p className="text-xs text-red-600 dark:text-red-400">{slipError}</p>}
                                  <button
                                    onClick={() => saveSlip(slip.id)}
                                    disabled={savingSlip}
                                    className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50"
                                  >
                                    {savingSlip ? 'Saving…' : 'Save'}
                                  </button>
                                </>
                              ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                  <p>
                                    Basic {formatMVR(slip.basic_salary)} · Food {formatMVR(slip.food_allowance)} ·
                                    Phone {formatMVR(slip.phone_allowance)}
                                  </p>
                                  {slip.bonus > 0 && (
                                    <p>
                                      Bonus {formatMVR(slip.bonus)}
                                      {slip.bonus_notes ? ` (${slip.bonus_notes})` : ''}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Extra trips
                                </p>
                                {trips.length > 0 && (
                                  <div className="rounded-lg border border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800 mb-2">
                                    {trips.map((t) => (
                                      <div
                                        key={t.id}
                                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                                      >
                                        <span className="text-gray-600 dark:text-gray-300">
                                          {t.trip_date} · {t.description || 'Trip'}
                                        </span>
                                        <span className="flex items-center gap-2">
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {formatMVR(t.amount)}
                                          </span>
                                          {isDraft && (
                                            <button
                                              onClick={() => removeTrip(t.id)}
                                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                              aria-label="Remove trip"
                                            >
                                              <Trash2 size={14} strokeWidth={1.75} />
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {isDraft && (
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      type="date"
                                      value={newTripDate}
                                      onChange={(e) => setNewTripDate(e.target.value)}
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      value={newTripDescription}
                                      onChange={(e) => setNewTripDescription(e.target.value)}
                                      placeholder="Description"
                                      className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={newTripAmount}
                                      onChange={(e) => setNewTripAmount(e.target.value)}
                                      placeholder="Amount"
                                      className="w-24 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <button
                                      onClick={() => addTrip(slip.id)}
                                      disabled={addingTrip || !newTripAmount}
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                                    >
                                      Add trip
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Deductions (e.g. advances)
                                </p>
                                {deductions.length > 0 && (
                                  <div className="rounded-lg border border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800 mb-2">
                                    {deductions.map((d) => (
                                      <div
                                        key={d.id}
                                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                                      >
                                        <span className="text-gray-600 dark:text-gray-300">
                                          {d.deduction_date} · {d.description || 'Deduction'}
                                          {d.loan_id && (
                                            <span className="text-gray-400 dark:text-gray-500"> · loan</span>
                                          )}
                                        </span>
                                        <span className="flex items-center gap-2">
                                          <span className="text-red-600 dark:text-red-400">
                                            -{formatMVR(d.amount)}
                                          </span>
                                          {isDraft && (
                                            <button
                                              onClick={() => removeDeduction(d.id)}
                                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                              aria-label="Remove deduction"
                                            >
                                              <Trash2 size={14} strokeWidth={1.75} />
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {isDraft && (
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      type="date"
                                      value={newDeductionDate}
                                      onChange={(e) => setNewDeductionDate(e.target.value)}
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      value={newDeductionDescription}
                                      onChange={(e) => setNewDeductionDescription(e.target.value)}
                                      placeholder="Reason (e.g. Advance)"
                                      className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={newDeductionAmount}
                                      onChange={(e) => setNewDeductionAmount(e.target.value)}
                                      placeholder="Amount"
                                      className="w-24 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs"
                                    />
                                    <button
                                      onClick={() => addDeduction(slip.id)}
                                      disabled={addingDeduction || !newDeductionAmount}
                                      className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                                    >
                                      Add deduction
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedRun.status === 'draft' && runSlips.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pay date</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 dark:border-neutral-700"
                      />
                      <span>
                        Add {formatMVR(runTotal)} across {runSlips.length}{' '}
                        {runSlips.length === 1 ? 'expense' : 'expenses'} to Expenses — only happens when you check
                        this box and confirm below, never automatically.
                      </span>
                    </label>
                    {confirmError && (
                      <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                        <p className="text-sm text-red-600 dark:text-red-400">{confirmError}</p>
                      </div>
                    )}
                    <button
                      onClick={confirmRun}
                      disabled={!confirmChecked || confirming}
                      className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50"
                    >
                      {confirming ? 'Confirming…' : 'Confirm & add to expenses'}
                    </button>
                  </div>
                )}
                {selectedRun.status === 'confirmed' && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    This run is confirmed — its expenses are on the Expenses tab. Edit or delete them there if
                    something needs to change.
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
