'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, X, Trash2, Paperclip, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import { EXPENSE_CATEGORY_SUGGESTIONS } from '@/lib/types'
import DateRangeFilter from '@/components/DateRangeFilter'
import { computeIncomeTaxBreakdown, extractTax } from '@/lib/tax'
import { currentMonthRange } from '@/lib/dateRange'
import SalaryPanel from '@/components/SalaryPanel'
import { SkeletonList } from '@/components/Skeleton'

type VesselOption = { id: string; name: string }
type ExpenseRow = {
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
  vessels: { name: string } | null
}
type FuelCostRow = {
  id: string
  vessel_id: string
  quantity: number
  cost: number | null
  filled_at: string
}
type DisplayRow = {
  id: string
  kind: 'manual' | 'fuel'
  category: string
  amount: number
  taxAmount: number | null
  date: string
  vendor: string
  vesselName: string
  receiptPath: string | null
}
type IncomeRow = {
  id: string
  amount: number
  income_date: string
  is_tax_free: boolean
}

export default function ExpensesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'expenses' | 'salary' | 'tax'>('expenses')

  const [vessels, setVessels] = useState<VesselOption[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [incomeLineTotals, setIncomeLineTotals] = useState<Record<string, { taxFreeAmount: number; taxableAmount: number }>>({})
  const [defaultTaxPercent, setDefaultTaxPercent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [vesselId, setVesselId] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [hasTax, setHasTax] = useState(false)
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVesselId, setEditVesselId] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editHasTax, setEditHasTax] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editVendor, setEditVendor] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [recordAsExpense, setRecordAsExpense] = useState(false)
  const [savingTaxExpense, setSavingTaxExpense] = useState(false)
  const [taxExpenseError, setTaxExpenseError] = useState<string | null>(null)
  const [taxExpenseSaved, setTaxExpenseSaved] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, expensesRes, fuelRes, settingsRes, incomeRes, incomeLinesRes] = await Promise.all([
        supabase.from('vessels').select('id, name').order('name'),
        supabase
          .from('expenses')
          .select(
            'id, vessel_id, category, amount, has_tax, tax_percent, tax_amount, expense_date, vendor, notes, receipt_path, vessels(name)'
          )
          .order('expense_date', { ascending: false }),
        supabase
          .from('fuel_entry_cost')
          .select('id, vessel_id, quantity, cost, filled_at')
          .order('filled_at', { ascending: false }),
        supabase.from('app_settings').select('tax_percent').maybeSingle(),
        supabase.from('income_entries').select('id, amount, income_date, is_tax_free'),
        supabase.from('income_entry_line_totals').select('income_entry_id, tax_free_amount, taxable_amount'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (expensesRes.error) throw expensesRes.error
      if (fuelRes.error) throw fuelRes.error
      if (settingsRes.error) throw settingsRes.error
      if (incomeRes.error) throw incomeRes.error
      if (incomeLinesRes.error) throw incomeLinesRes.error
      setVessels((vesselsRes.data as VesselOption[]) ?? [])
      setExpenses((expensesRes.data as unknown as ExpenseRow[]) ?? [])
      setFuelCosts((fuelRes.data as FuelCostRow[]) ?? [])
      setDefaultTaxPercent(settingsRes.data?.tax_percent ?? 0)
      setIncome((incomeRes.data as IncomeRow[]) ?? [])
      const groupedLines: Record<string, { taxFreeAmount: number; taxableAmount: number }> = {}
      for (const l of (incomeLinesRes.data as
        | { income_entry_id: string; tax_free_amount: number; taxable_amount: number }[]
        | null) ?? []) {
        groupedLines[l.income_entry_id] = { taxFreeAmount: l.tax_free_amount, taxableAmount: l.taxable_amount }
      }
      setIncomeLineTotals(groupedLines)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load expenses.')
    } finally {
      setLoading(false)
    }
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data: entry, error } = await supabase
      .from('expenses')
      .insert({
        vessel_id: vesselId || null,
        category: category.trim() || 'Other',
        amount: Number(amount),
        has_tax: hasTax,
        tax_percent: hasTax ? defaultTaxPercent : null,
        tax_amount: hasTax ? extractTax(Number(amount) || 0, defaultTaxPercent) : null,
        expense_date: expenseDate,
        vendor,
        notes,
      })
      .select('id')
      .single()
    if (error || !entry) {
      setSaving(false)
      setError(error?.message ?? 'Failed to save expense.')
      return
    }
    if (receiptFile) {
      const path = `${entry.id}/${receiptFile.name}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, receiptFile)
      if (uploadError) {
        setSaving(false)
        setError(`Expense saved, but the receipt photo failed to upload: ${uploadError.message}`)
        load()
        return
      }
      await supabase.from('expenses').update({ receipt_path: path }).eq('id', entry.id)
    }
    setSaving(false)
    setVesselId('')
    setCategory('')
    setAmount('')
    setHasTax(false)
    setVendor('')
    setNotes('')
    setReceiptFile(null)
    setShowAdd(false)
    load()
  }

  async function viewReceipt(path: string, id: string) {
    setViewingReceiptId(id)
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
    setViewingReceiptId(null)
    if (error || !data) {
      setError(error?.message ?? 'Failed to open receipt.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteExpense(id: string) {
    setDeletingId(id)
    const receiptPath = expenses.find((e) => e.id === id)?.receipt_path
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error && receiptPath) {
      await supabase.storage.from('receipts').remove([receiptPath])
    }
    setDeletingId(null)
    if (!error) setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id)
    setEditVesselId(row.vessel_id ?? '')
    setEditCategory(row.category)
    setEditAmount(String(row.amount))
    setEditHasTax(row.has_tax)
    setEditDate(row.expense_date)
    setEditVendor(row.vendor)
    setEditNotes(row.notes)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    setEditError(null)
    const amountValue = Number(editAmount)
    const { error } = await supabase
      .from('expenses')
      .update({
        vessel_id: editVesselId || null,
        category: editCategory.trim() || 'Other',
        amount: amountValue,
        has_tax: editHasTax,
        tax_percent: editHasTax ? defaultTaxPercent : null,
        tax_amount: editHasTax ? extractTax(amountValue, defaultTaxPercent) : null,
        expense_date: editDate,
        vendor: editVendor,
        notes: editNotes,
      })
      .eq('id', id)
    setSavingEdit(false)
    if (error) {
      setEditError(error.message)
      return
    }
    setEditingId(null)
    load()
  }

  const previewTaxAmount = hasTax ? extractTax(Number(amount) || 0, defaultTaxPercent) : 0
  const editPreviewTaxAmount = editHasTax ? extractTax(Number(editAmount) || 0, defaultTaxPercent) : 0

  const vesselNames = useMemo(() => new Map(vessels.map((v) => [v.id, v.name])), [vessels])

  const combined: DisplayRow[] = useMemo(() => {
    const manual: DisplayRow[] = expenses.map((e) => ({
      id: e.id,
      kind: 'manual',
      category: e.category,
      amount: e.amount,
      taxAmount: e.has_tax ? e.tax_amount : null,
      date: e.expense_date,
      vendor: e.vendor,
      vesselName: e.vessels?.name ?? 'Unassigned',
      receiptPath: e.receipt_path,
    }))
    const fuel: DisplayRow[] = fuelCosts
      .filter((f) => f.cost != null)
      .map((f) => ({
        id: f.id,
        kind: 'fuel',
        category: 'Fuel',
        amount: f.cost ?? 0,
        taxAmount: null,
        date: f.filled_at,
        vendor: `${f.quantity.toLocaleString()} L`,
        vesselName: vesselNames.get(f.vessel_id) ?? 'Unassigned',
        receiptPath: null,
      }))
    return [...manual, ...fuel].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [expenses, fuelCosts, vesselNames])

  const filtered = useMemo(
    () => combined.filter((e) => (!from || e.date >= from) && (!to || e.date <= to)),
    [combined, from, to]
  )

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered])

  const filteredIncome = useMemo(
    () => income.filter((i) => (!from || i.income_date >= from) && (!to || i.income_date <= to)),
    [income, from, to]
  )
  const incomeBreakdownTotals = useMemo(
    () =>
      filteredIncome.reduce(
        (acc, i) => {
          const b = computeIncomeTaxBreakdown(i.amount, i.is_tax_free, incomeLineTotals[i.id], defaultTaxPercent)
          acc.outputTax += b.tax
          acc.taxFreeIncome += b.taxFreeAmount
          return acc
        },
        { outputTax: 0, taxFreeIncome: 0 }
      ),
    [filteredIncome, incomeLineTotals, defaultTaxPercent]
  )
  const outputTax = incomeBreakdownTotals.outputTax
  const taxFreeIncome = incomeBreakdownTotals.taxFreeIncome
  const taxSaved = useMemo(() => extractTax(taxFreeIncome, defaultTaxPercent), [taxFreeIncome, defaultTaxPercent])
  const inputTax = useMemo(
    () =>
      expenses
        .filter((e) => e.has_tax && (!from || e.expense_date >= from) && (!to || e.expense_date <= to))
        .reduce((sum, e) => sum + (e.tax_amount ?? 0), 0),
    [expenses, from, to]
  )
  const netTax = outputTax - inputTax

  async function addNetTaxAsExpense() {
    setSavingTaxExpense(true)
    setTaxExpenseError(null)
    setTaxExpenseSaved(false)
    const { error } = await supabase.from('expenses').insert({
      vessel_id: null,
      category: 'Tax',
      amount: netTax,
      has_tax: false,
      tax_percent: null,
      tax_amount: null,
      expense_date: new Date().toISOString().slice(0, 10),
      vendor: '',
      notes: `Net tax payable${from || to ? ` for ${from || '…'} to ${to || '…'}` : ''}: output ${formatMVR(outputTax)} − input ${formatMVR(inputTax)}`,
    })
    setSavingTaxExpense(false)
    if (error) {
      setTaxExpenseError(error.message)
      return
    }
    setTaxExpenseSaved(true)
    setRecordAsExpense(false)
    load()
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        {tab === 'expenses' && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800"
          >
            {showAdd ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
            {showAdd ? 'Cancel' : 'Add expense'}
          </button>
        )}
      </div>

      <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setTab('expenses')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === 'expenses'
              ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
              : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setTab('salary')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === 'salary'
              ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
              : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
          }`}
        >
          Salary
        </button>
        <button
          type="button"
          onClick={() => setTab('tax')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === 'tax'
              ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
              : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
          }`}
        >
          Tax management
        </button>
      </div>

      {tab === 'salary' && <SalaryPanel />}

      {tab === 'expenses' && showAdd && (
        <form
          onSubmit={addExpense}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <select
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          >
            <option value="">Unassigned (fleet-wide)</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <div>
            <input
              required
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            <datalist id="category-suggestions">
              {EXPENSE_CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (MVR)"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasTax}
                onChange={(e) => setHasTax(e.target.checked)}
                className="rounded border-gray-300 dark:border-neutral-700"
              />
              This expense has tax
            </label>
            {hasTax && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {defaultTaxPercent}% tax ={' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{formatMVR(previewTaxAmount)}</span>
                {' '}(set in Settings)
              </p>
            )}
          </div>
          <input
            required
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Vendor (optional)"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Receipt photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </form>
      )}

      {tab !== 'salary' && <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}

      {tab === 'expenses' &&
        (loading ? (
          <SkeletonList />
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              onClick={load}
              className="text-sm font-medium text-sky-600 dark:text-sky-400 transition-colors hover:text-sky-700 dark:hover:text-sky-300"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No expenses in this range.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total: <span className="font-medium text-gray-900 dark:text-gray-100">{formatMVR(total)}</span>
            </p>
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
              {filtered.map((e) => (
                <div key={`${e.kind}-${e.id}`}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60 active:bg-gray-100 dark:active:bg-neutral-800">
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-1.5">
                        {e.category}
                        {e.vendor && <span className="text-gray-400 dark:text-gray-500"> · {e.vendor}</span>}
                        {e.kind === 'fuel' && (
                          <span className="text-xs font-normal text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-800 rounded px-1.5 py-0.5">
                            From fuel-tracker
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {e.date} · {e.vesselName}
                        {e.taxAmount != null && ` · incl. ${formatMVR(e.taxAmount)} tax`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-medium">{formatMVR(e.amount)}</span>
                      {e.receiptPath && (
                        <button
                          onClick={() => viewReceipt(e.receiptPath!, e.id)}
                          disabled={viewingReceiptId === e.id}
                          className="text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-950/50 disabled:opacity-50"
                          aria-label="View receipt"
                        >
                          <Paperclip size={16} strokeWidth={1.75} />
                        </button>
                      )}
                      {e.kind === 'manual' && (
                        <>
                          <button
                            onClick={() => {
                              if (editingId === e.id) {
                                cancelEdit()
                                return
                              }
                              const row = expenses.find((x) => x.id === e.id)
                              if (row) startEdit(row)
                            }}
                            className="text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-950/50"
                            aria-label="Edit"
                          >
                            <Pencil size={16} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            disabled={deletingId === e.id}
                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-50"
                            aria-label="Delete"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === e.id && (
                    <form
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        saveEdit(e.id)
                      }}
                      className="px-4 pb-4 pl-10 space-y-2"
                    >
                      <select
                        value={editVesselId}
                        onChange={(ev) => setEditVesselId(ev.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                      >
                        <option value="">Unassigned (fleet-wide)</option>
                        {vessels.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <div>
                        <input
                          required
                          list="edit-category-suggestions"
                          value={editCategory}
                          onChange={(ev) => setEditCategory(ev.target.value)}
                          placeholder="Category"
                          className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                        />
                        <datalist id="edit-category-suggestions">
                          {EXPENSE_CATEGORY_SUGGESTIONS.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAmount}
                        onChange={(ev) => setEditAmount(ev.target.value)}
                        placeholder="Amount (MVR)"
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                      />
                      <div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editHasTax}
                            onChange={(ev) => setEditHasTax(ev.target.checked)}
                            className="rounded border-gray-300 dark:border-neutral-700"
                          />
                          This expense has tax
                        </label>
                        {editHasTax && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {defaultTaxPercent}% tax ={' '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {formatMVR(editPreviewTaxAmount)}
                            </span>
                          </p>
                        )}
                      </div>
                      <input
                        required
                        type="date"
                        value={editDate}
                        onChange={(ev) => setEditDate(ev.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                      />
                      <input
                        value={editVendor}
                        onChange={(ev) => setEditVendor(ev.target.value)}
                        placeholder="Vendor (optional)"
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                      />
                      <textarea
                        value={editNotes}
                        onChange={(ev) => setEditNotes(ev.target.value)}
                        placeholder="Notes (optional)"
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                      />
                      {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
                      <div className="flex gap-2">
                        <button
                          disabled={savingEdit}
                          className="flex-1 rounded-lg bg-sky-600 text-white py-1.5 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50"
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </>
        ))}

      {tab === 'tax' && !loading && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            For the selected date range above — output tax is the tax portion of non-tax-free income,
            input tax is the tax portion already recorded on your taxed expenses (incl. fuel-tracker
            purchases only if entered as expenses with tax).
          </p>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Output tax (on income)</span>
              <span className="font-medium">{formatMVR(outputTax)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Input tax (on expenses)</span>
              <span className="font-medium">− {formatMVR(inputTax)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
              <span>{netTax >= 0 ? 'Net tax payable' : 'Net tax credit'}</span>
              <span className={netTax >= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {formatMVR(Math.abs(netTax))}
              </span>
            </div>
          </div>

          {taxFreeIncome > 0 && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 divide-y divide-emerald-100 dark:divide-emerald-900">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tax-free income</span>
                <span className="font-medium">{formatMVR(taxFreeIncome)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tax saved</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatMVR(taxSaved)}
                </span>
              </div>
            </div>
          )}

          {netTax > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recordAsExpense}
                  onChange={(e) => {
                    setRecordAsExpense(e.target.checked)
                    setTaxExpenseSaved(false)
                  }}
                  className="mt-0.5 rounded border-gray-300 dark:border-neutral-700"
                />
                <span>
                  Record this net tax as an expense — only added when you check this box and confirm
                  below, never automatically.
                </span>
              </label>
              {taxExpenseError && <p className="text-sm text-red-600 dark:text-red-400">{taxExpenseError}</p>}
              {taxExpenseSaved && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Added {formatMVR(netTax)} to Expenses under &quot;Tax&quot;.
                </p>
              )}
              <button
                onClick={addNetTaxAsExpense}
                disabled={!recordAsExpense || savingTaxExpense}
                className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
              >
                {savingTaxExpense ? 'Saving…' : `Add ${formatMVR(netTax)} to expenses`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
