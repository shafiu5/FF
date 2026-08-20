'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { Vessel } from '@/lib/types'
import { currentMonthRange } from '@/lib/dateRange'
import { formatPercent, profitMargin } from '@/lib/margin'
import Skeleton, { SkeletonList } from '@/components/Skeleton'
import Logo from '@/components/Logo'
import { computeIncomeTaxBreakdown } from '@/lib/tax'
import { exportDetailedReport } from '@/lib/detailedReportExport'

type ExpenseRow = {
  id: string
  category: string
  amount: number
  expense_date: string
  vendor: string
  has_tax: boolean
  tax_amount: number | null
}
type IncomeRow = {
  id: string
  amount: number
  income_date: string
  reference: string
  description: string
  is_tax_free: boolean
}
type FuelCostRow = { id: string; quantity: number; cost: number | null; filled_at: string }
type LineTotals = { taxFreeAmount: number; taxableAmount: number }

type TimelineItem = {
  id: string
  kind: 'expense' | 'income' | 'fuel'
  date: string
  label: string
  amount: number
}

export default function VesselDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [vessel, setVessel] = useState<Vessel | null>(null)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [incomeLineTotals, setIncomeLineTotals] = useState<Record<string, LineTotals>>({})
  const [taxPercent, setTaxPercent] = useState(0)
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [passengerTotals, setPassengerTotals] = useState<{ income_date: string; passenger_count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [excludeTaxFree, setExcludeTaxFree] = useState(false)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  useEffect(() => {
    if (id) load()
  }, [id])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselRes, expensesRes, incomeRes, incomeLinesRes, settingsRes, fuelRes, passengerLinesRes] =
        await Promise.all([
          supabase.from('vessels').select('id, name, notes, created_at').eq('id', id).maybeSingle(),
          supabase
            .from('expenses')
            .select('id, category, amount, expense_date, vendor, has_tax, tax_amount')
            .eq('vessel_id', id)
            .order('expense_date', { ascending: false }),
          supabase
            .from('income_entries')
            .select('id, amount, income_date, reference, description, is_tax_free')
            .eq('vessel_id', id)
            .order('income_date', { ascending: false }),
          supabase
            .from('income_entry_line_totals')
            .select('income_entry_id, tax_free_amount, taxable_amount')
            .eq('vessel_id', id),
          supabase.from('app_settings').select('tax_percent').maybeSingle(),
          supabase
            .from('fuel_entry_cost')
            .select('id, quantity, cost, filled_at')
            .eq('vessel_id', id)
            .order('filled_at', { ascending: false }),
          supabase
            .from('income_entry_line_totals')
            .select('income_date, passenger_count')
            .eq('vessel_id', id),
        ])
      if (vesselRes.error) throw vesselRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (incomeLinesRes.error) throw incomeLinesRes.error
      if (settingsRes.error) throw settingsRes.error
      if (fuelRes.error) throw fuelRes.error
      if (passengerLinesRes.error) throw passengerLinesRes.error
      setVessel(vesselRes.data as Vessel | null)
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
      setPassengerTotals(
        (passengerLinesRes.data as { income_date: string; passenger_count: number }[]) ?? []
      )
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load this vessel.')
    } finally {
      setLoading(false)
    }
  }

  const timeline: TimelineItem[] = useMemo(() => {
    const e: TimelineItem[] = expenses.map((x) => ({
      id: x.id,
      kind: 'expense',
      date: x.expense_date,
      label: x.category + (x.vendor ? ` · ${x.vendor}` : ''),
      amount: -x.amount,
    }))
    const i: TimelineItem[] = income.map((x) => ({
      id: x.id,
      kind: 'income',
      date: x.income_date,
      label: (x.description || x.reference || 'Income') + (x.is_tax_free ? ' (tax-free)' : ''),
      amount: x.amount,
    }))
    const f: TimelineItem[] = fuelCosts
      .filter((x) => x.cost != null)
      .map((x) => ({
        id: x.id,
        kind: 'fuel',
        date: x.filled_at,
        label: `Fuel · ${x.quantity.toLocaleString()} L`,
        amount: -(x.cost ?? 0),
      }))
    return [...e, ...i, ...f].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [expenses, income, fuelCosts])

  const filtered = useMemo(
    () => timeline.filter((t) => (!from || t.date >= from) && (!to || t.date <= to)),
    [timeline, from, to]
  )

  const totalIncome = useMemo(
    () => filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [filtered]
  )
  const totalExpense = useMemo(
    () => -filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
    [filtered]
  )
  const totalPassengers = useMemo(
    () =>
      passengerTotals
        .filter((p) => (!from || p.income_date >= from) && (!to || p.income_date <= to))
        .reduce((sum, p) => sum + p.passenger_count, 0),
    [passengerTotals, from, to]
  )
  const margin = profitMargin(totalIncome, totalExpense)

  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)

  function exportReport() {
    const incomeRows = income
      .filter((i) => inRange(i.income_date))
      .map((i) => {
        const b = computeIncomeTaxBreakdown(i.amount, i.is_tax_free, incomeLineTotals[i.id], taxPercent)
        return {
          date: i.income_date,
          vessel: vessel?.name ?? '',
          reference: i.reference,
          description: i.description,
          amount: i.amount,
          taxFreeAmount: b.taxFreeAmount,
          taxableAmount: b.taxableAmount,
          tax: b.tax,
        }
      })

    const expenseRows = [
      ...expenses
        .filter((e) => inRange(e.expense_date))
        .map((e) => ({
          date: e.expense_date,
          vessel: vessel?.name ?? '',
          category: e.category,
          vendor: e.vendor,
          amount: e.amount,
          hasTax: e.has_tax,
          taxAmount: e.tax_amount ?? 0,
          source: 'Manual',
        })),
      ...fuelCosts
        .filter((f) => f.cost != null && inRange(f.filled_at))
        .map((f) => ({
          date: f.filled_at,
          vessel: vessel?.name ?? '',
          category: 'Fuel',
          vendor: `${f.quantity.toLocaleString()} L`,
          amount: f.cost ?? 0,
          hasTax: false,
          taxAmount: 0,
          source: 'Fuel-tracker',
        })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1))

    exportDetailedReport({
      filename: `${(vessel?.name ?? 'vessel').replace(/\s+/g, '-').toLowerCase()}-report-${from || 'all'}-to-${to || 'all'}.xlsx`,
      income: incomeRows,
      expenses: expenseRows,
      excludeTaxFree,
    })
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-4 w-20" />
        <div>
          <Skeleton className="h-7 w-40 mb-3" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <SkeletonList withHeading={false} />
      </main>
    )
  }
  if (loadError) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button
            onClick={load}
            className="text-sm font-medium text-sky-600 dark:text-sky-400 transition-colors hover:text-sky-700 dark:hover:text-sky-300"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }
  if (!vessel) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Link
        href="/vessels"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
      >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Books
        </Link>
        <p className="text-gray-400 dark:text-gray-500">Vessel not found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/vessels"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Books
        </Link>
        <Logo />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-3">{vessel.name}</h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Net</p>
            <p
              className={`text-lg font-bold ${
                totalIncome - totalExpense >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatMVR(totalIncome - totalExpense)}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatMVR(totalIncome)} in · {formatMVR(totalExpense)} out
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Profit margin</p>
            <p
              className={`text-lg font-bold ${
                margin == null
                  ? 'text-gray-400 dark:text-gray-500'
                  : margin >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {margin == null ? '—' : formatPercent(margin)}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {formatMVR(totalIncome - totalExpense)} ÷ {formatMVR(totalIncome)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Passengers</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {totalPassengers.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Ledger</h2>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={excludeTaxFree}
                onChange={(e) => setExcludeTaxFree(e.target.checked)}
                className="rounded border-gray-300 dark:border-neutral-700"
              />
              Exclude tax-free
            </label>
            <button
              type="button"
              onClick={exportReport}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
            >
              <FileSpreadsheet size={16} strokeWidth={1.75} />
              Export Excel
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No activity in this range.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {filtered.map((t) => (
              <div
                key={`${t.kind}-${t.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
              >
                <div>
                  <p>{t.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t.date}</p>
                </div>
                <span
                  className={`font-medium ${t.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {t.amount >= 0 ? '+' : '−'}
                  {formatMVR(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
