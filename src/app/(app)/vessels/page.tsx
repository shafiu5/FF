'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import type { Vessel } from '@/lib/types'
import DateRangeFilter from '@/components/DateRangeFilter'
import { currentMonthRange } from '@/lib/dateRange'
import { formatPercent, profitMargin } from '@/lib/margin'
import { SkeletonList } from '@/components/Skeleton'
import IncomeStatement from '@/components/IncomeStatement'
import Logo from '@/components/Logo'
import { computeIncomeTaxBreakdown } from '@/lib/tax'
import { exportDetailedReport } from '@/lib/detailedReportExport'

type ExpenseRow = {
  id: string
  vessel_id: string | null
  category: string
  vendor: string
  amount: number
  expense_date: string
  has_tax: boolean
  tax_amount: number | null
}
type IncomeRow = {
  id: string
  vessel_id: string | null
  amount: number
  income_date: string
  reference: string
  description: string
  is_tax_free: boolean
}
type FuelCostRow = { vessel_id: string; quantity: number; cost: number | null; filled_at: string }
type PassengerTotalRow = { vessel_id: string | null; income_date: string; passenger_count: number }
type LineTotals = { taxFreeAmount: number; taxableAmount: number }

const tabButtonClass = (active: boolean) =>
  `flex-1 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
      : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
  }`

export default function VesselsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'vessels' | 'reports'>('vessels')
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [incomeLineTotals, setIncomeLineTotals] = useState<Record<string, LineTotals>>({})
  const [taxPercent, setTaxPercent] = useState(0)
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [passengerTotals, setPassengerTotals] = useState<PassengerTotalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [excludeTaxFree, setExcludeTaxFree] = useState(false)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, expensesRes, incomeRes, incomeLinesRes, settingsRes, fuelRes, passengerLinesRes] =
        await Promise.all([
          supabase.from('vessels').select('id, name, notes, created_at').order('name'),
          supabase
            .from('expenses')
            .select('id, vessel_id, category, vendor, amount, expense_date, has_tax, tax_amount'),
          supabase
            .from('income_entries')
            .select('id, vessel_id, amount, income_date, reference, description, is_tax_free'),
          supabase.from('income_entry_line_totals').select('income_entry_id, tax_free_amount, taxable_amount'),
          supabase.from('app_settings').select('tax_percent').maybeSingle(),
          supabase.from('fuel_entry_cost').select('vessel_id, quantity, cost, filled_at'),
          supabase.from('income_entry_line_totals').select('vessel_id, income_date, passenger_count'),
        ])
      if (vesselsRes.error) throw vesselsRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (incomeLinesRes.error) throw incomeLinesRes.error
      if (settingsRes.error) throw settingsRes.error
      if (fuelRes.error) throw fuelRes.error
      if (passengerLinesRes.error) throw passengerLinesRes.error
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
      setPassengerTotals((passengerLinesRes.data as PassengerTotalRow[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load vessels.')
    } finally {
      setLoading(false)
    }
  }

  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)

  const totals = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; passengers: number }>()
    for (const v of vessels) map.set(v.id, { expense: 0, income: 0, passengers: 0 })
    const unassigned = { expense: 0, income: 0, passengers: 0 }
    for (const e of expenses) {
      if (!inRange(e.expense_date)) continue
      if (!e.vessel_id) {
        unassigned.expense += e.amount
        continue
      }
      const t = map.get(e.vessel_id)
      if (t) t.expense += e.amount
    }
    for (const f of fuelCosts) {
      if (!inRange(f.filled_at)) continue
      const t = map.get(f.vessel_id)
      if (t && f.cost != null) t.expense += f.cost
    }
    for (const i of income) {
      if (!inRange(i.income_date)) continue
      if (!i.vessel_id) {
        unassigned.income += i.amount
        continue
      }
      const t = map.get(i.vessel_id)
      if (t) t.income += i.amount
    }
    for (const p of passengerTotals) {
      if (!inRange(p.income_date)) continue
      if (!p.vessel_id) {
        unassigned.passengers += p.passenger_count
        continue
      }
      const t = map.get(p.vessel_id)
      if (t) t.passengers += p.passenger_count
    }
    return { map, unassigned }
  }, [vessels, expenses, income, fuelCosts, passengerTotals, from, to])

  function vesselName(vesselId: string | null): string {
    if (!vesselId) return 'Unassigned'
    return vessels.find((v) => v.id === vesselId)?.name ?? 'Unassigned'
  }

  function exportReport() {
    const incomeRows = income
      .filter((i) => inRange(i.income_date))
      .map((i) => {
        const b = computeIncomeTaxBreakdown(i.amount, i.is_tax_free, incomeLineTotals[i.id], taxPercent)
        return {
          date: i.income_date,
          vessel: vesselName(i.vessel_id),
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
          vessel: vesselName(e.vessel_id),
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
          vessel: vesselName(f.vessel_id),
          category: 'Fuel',
          vendor: `${f.quantity.toLocaleString()} L`,
          amount: f.cost ?? 0,
          hasTax: false,
          taxAmount: 0,
          source: 'Fuel-tracker',
        })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1))

    exportDetailedReport({
      filename: `vessel-finance-report-${from || 'all'}-to-${to || 'all'}.xlsx`,
      income: incomeRows,
      expenses: expenseRows,
      excludeTaxFree,
    })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Books</h1>
        <Logo />
      </div>

      <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
        <button type="button" onClick={() => setTab('vessels')} className={tabButtonClass(tab === 'vessels')}>
          Books
        </button>
        <button type="button" onClick={() => setTab('reports')} className={tabButtonClass(tab === 'reports')}>
          Income Statement
        </button>
      </div>

      {tab === 'reports' && <IncomeStatement />}

      {tab === 'vessels' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={16} strokeWidth={1.75} />
              Export Excel
            </button>
          </div>
        </div>
      )}

      {tab === 'vessels' &&
        (loading ? (
        <SkeletonList withHeading={false} />
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
      ) : vessels.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No vessels yet — add one in Fuel Tracker&apos;s Vessels page, it&apos;ll show up here.
        </p>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {vessels.map((v) => {
            const t = totals.map.get(v.id) ?? { expense: 0, income: 0, passengers: 0 }
            const net = t.income - t.expense
            const margin = profitMargin(t.income, t.expense)
            return (
              <Link
                key={v.id}
                href={`/vessels/${v.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60 active:bg-gray-100 dark:active:bg-neutral-800"
              >
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatMVR(t.income)} in · {formatMVR(t.expense)} out
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {margin == null ? '—' : formatPercent(margin)} margin
                    {t.passengers > 0 && ` · ${t.passengers.toLocaleString()} passengers`}
                  </p>
                </div>
                <span
                  className={`font-medium ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {formatMVR(net)}
                </span>
              </Link>
            )
          })}
          {(totals.unassigned.income !== 0 || totals.unassigned.expense !== 0 || totals.unassigned.passengers !== 0) && (
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400 italic">Unassigned</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatMVR(totals.unassigned.income)} in · {formatMVR(totals.unassigned.expense)} out
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {(() => {
                    const m = profitMargin(totals.unassigned.income, totals.unassigned.expense)
                    return m == null ? '—' : formatPercent(m)
                  })()}{' '}
                  margin
                  {totals.unassigned.passengers > 0 && ` · ${totals.unassigned.passengers.toLocaleString()} passengers`}
                </p>
              </div>
              <span
                className={`font-medium ${
                  totals.unassigned.income - totals.unassigned.expense >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatMVR(totals.unassigned.income - totals.unassigned.expense)}
              </span>
            </div>
          )}
        </div>
      ))}
    </main>
  )
}
