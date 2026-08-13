'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { Vessel } from '@/lib/types'
import { currentMonthRange } from '@/lib/dateRange'
import { formatPercent, profitMargin } from '@/lib/margin'
import { SkeletonList } from '@/components/Skeleton'
import { computeIncomeTaxBreakdown } from '@/lib/tax'

type ExpenseRow = { vessel_id: string | null; category: string; amount: number; expense_date: string }
type IncomeRow = { id: string; vessel_id: string | null; amount: number; income_date: string; is_tax_free: boolean }
type FuelCostRow = { vessel_id: string; cost: number | null; filled_at: string }
type LineTotals = { taxFreeAmount: number; taxableAmount: number }

export default function IncomeStatement() {
  const supabase = createClient()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [incomeLineTotals, setIncomeLineTotals] = useState<Record<string, LineTotals>>({})
  const [taxPercent, setTaxPercent] = useState(0)
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)
  const [vesselId, setVesselId] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, expensesRes, incomeRes, incomeLinesRes, settingsRes, fuelRes] = await Promise.all([
        supabase.from('vessels').select('id, name, notes, created_at').order('name'),
        supabase.from('expenses').select('vessel_id, category, amount, expense_date'),
        supabase.from('income_entries').select('id, vessel_id, amount, income_date, is_tax_free'),
        supabase.from('income_entry_line_totals').select('income_entry_id, tax_free_amount, taxable_amount'),
        supabase.from('app_settings').select('tax_percent').eq('id', true).maybeSingle(),
        supabase.from('fuel_entry_cost').select('vessel_id, cost, filled_at'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (incomeLinesRes.error) throw incomeLinesRes.error
      if (settingsRes.error) throw settingsRes.error
      if (fuelRes.error) throw fuelRes.error
      setVessels((vesselsRes.data as Vessel[]) ?? [])
      setExpenses((expensesRes.data as ExpenseRow[]) ?? [])
      setIncome((incomeRes.data as IncomeRow[]) ?? [])
      const groupedLines: Record<string, LineTotals> = {}
      for (const l of (incomeLinesRes.data as
        | { income_entry_id: string; tax_free_amount: number; taxable_amount: number }[]
        | null) ?? []) {
        groupedLines[l.income_entry_id] = { taxFreeAmount: l.tax_free_amount, taxableAmount: l.taxable_amount }
      }
      setIncomeLineTotals(groupedLines)
      setTaxPercent(settingsRes.data?.tax_percent ?? 0)
      setFuelCosts((fuelRes.data as FuelCostRow[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the report.')
    } finally {
      setLoading(false)
    }
  }

  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)
  const inVessel = (id: string | null) => !vesselId || id === vesselId

  const filteredIncome = useMemo(
    () => income.filter((i) => inRange(i.income_date) && inVessel(i.vessel_id)),
    [income, from, to, vesselId]
  )
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.expense_date) && inVessel(e.vessel_id)),
    [expenses, from, to, vesselId]
  )
  const filteredFuel = useMemo(
    () => fuelCosts.filter((f) => f.cost != null && inRange(f.filled_at) && inVessel(f.vessel_id)),
    [fuelCosts, from, to, vesselId]
  )

  const totalIncome = useMemo(() => filteredIncome.reduce((s, i) => s + i.amount, 0), [filteredIncome])
  // An imported "whole file" entry can mix tax-free and taxable passengers
  // under one entry — its own is_tax_free flag isn't reliable, the per-line
  // totals are. computeIncomeTaxBreakdown prefers those when present.
  const { taxFreeIncome, taxableIncome } = useMemo(() => {
    let taxFree = 0
    let taxable = 0
    for (const i of filteredIncome) {
      const b = computeIncomeTaxBreakdown(i.amount, i.is_tax_free, incomeLineTotals[i.id], taxPercent)
      taxFree += b.taxFreeAmount
      taxable += b.taxableAmount
    }
    return { taxFreeIncome: taxFree, taxableIncome: taxable }
  }, [filteredIncome, incomeLineTotals, taxPercent])

  const fuelTotal = useMemo(() => filteredFuel.reduce((s, f) => s + (f.cost ?? 0), 0), [filteredFuel])

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filteredExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    if (fuelTotal > 0) map.set('Fuel', (map.get('Fuel') ?? 0) + fuelTotal)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filteredExpenses, fuelTotal])

  const totalExpense = useMemo(() => expensesByCategory.reduce((s, [, amount]) => s + amount, 0), [expensesByCategory])
  const netIncome = totalIncome - totalExpense
  const margin = profitMargin(totalIncome, totalExpense)

  const periodLabel = from && to ? `${from} to ${to}` : 'All dates'
  const vesselLabel = vesselId ? vessels.find((v) => v.id === vesselId)?.name ?? '' : 'All vessels'

  function exportExcel() {
    const rows: (string | number)[][] = [
      ['Income Statement'],
      [periodLabel, vesselLabel],
      [],
      ['Revenue'],
      ['Taxable income', taxableIncome],
      ['Tax-free income', taxFreeIncome],
      ['Total revenue', totalIncome],
      [],
      ['Expenses'],
      ...expensesByCategory.map(([category, amount]) => [category, amount]),
      ['Total expenses', totalExpense],
      [],
      ['Net income', netIncome],
      ['Profit margin', margin == null ? 'n/a' : `${margin.toFixed(1)}%`],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    worksheet['!cols'] = [{ wch: 24 }, { wch: 16 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Income Statement')
    XLSX.writeFile(workbook, `income-statement-${from || 'all'}-to-${to || 'all'}.xlsx`)
  }

  function exportPDF() {
    window.print()
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <select
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="">All vessels</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {!loading && !loadError && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
            >
              <FileSpreadsheet size={16} strokeWidth={1.75} />
              Excel
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
            >
              <Printer size={16} strokeWidth={1.75} />
              PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={6} withHeading={false} />
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
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <h2 className="font-semibold">Income Statement</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {periodLabel}
              {vesselId && ` · ${vesselLabel}`}
            </p>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Revenue
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Taxable income</span>
                <span>{formatMVR(taxableIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Tax-free income</span>
                <span>{formatMVR(taxFreeIncome)}</span>
              </div>
              <div className="flex items-center justify-between font-medium pt-1 border-t border-gray-100 dark:border-neutral-800">
                <span>Total revenue</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatMVR(totalIncome)}</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Expenses
            </p>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No expenses in this period.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {expensesByCategory.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{category}</span>
                    <span>{formatMVR(amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between font-medium pt-1 border-t border-gray-100 dark:border-neutral-800">
                  <span>Total expenses</span>
                  <span className="text-red-600 dark:text-red-400">{formatMVR(totalExpense)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Net income</span>
              <span
                className={`font-semibold ${netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {formatMVR(netIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>Profit margin</span>
              <span>{margin == null ? '—' : formatPercent(margin)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
