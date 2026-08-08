'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { Vessel } from '@/lib/types'
import { currentMonthRange } from '@/lib/dateRange'
import { formatPercent, profitMargin } from '@/lib/margin'

type ExpenseRow = { id: string; category: string; amount: number; expense_date: string; vendor: string }
type IncomeRow = {
  id: string
  amount: number
  income_date: string
  reference: string
  description: string
  is_tax_free: boolean
}
type FuelCostRow = { id: string; quantity: number; cost: number | null; filled_at: string }

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
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [passengerDates, setPassengerDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  useEffect(() => {
    if (id) load()
  }, [id])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselRes, expensesRes, incomeRes, fuelRes, passengerLinesRes] = await Promise.all([
        supabase.from('vessels').select('id, name, notes, created_at').eq('id', id).maybeSingle(),
        supabase
          .from('expenses')
          .select('id, category, amount, expense_date, vendor')
          .eq('vessel_id', id)
          .order('expense_date', { ascending: false }),
        supabase
          .from('income_entries')
          .select('id, amount, income_date, reference, description, is_tax_free')
          .eq('vessel_id', id)
          .order('income_date', { ascending: false }),
        supabase
          .from('fuel_entry_cost')
          .select('id, quantity, cost, filled_at')
          .eq('vessel_id', id)
          .order('filled_at', { ascending: false }),
        supabase
          .from('income_entry_lines')
          .select('income_entries!inner(vessel_id, income_date)')
          .eq('income_entries.vessel_id', id),
      ])
      if (vesselRes.error) throw vesselRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (fuelRes.error) throw fuelRes.error
      if (passengerLinesRes.error) throw passengerLinesRes.error
      setVessel(vesselRes.data as Vessel | null)
      setExpenses((expensesRes.data as ExpenseRow[]) ?? [])
      setIncome((incomeRes.data as IncomeRow[]) ?? [])
      setFuelCosts((fuelRes.data as FuelCostRow[]) ?? [])
      const passengerRows =
        (passengerLinesRes.data as unknown as { income_entries: { income_date: string } | null }[]) ?? []
      setPassengerDates(passengerRows.map((r) => r.income_entries?.income_date).filter((d): d is string => !!d))
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
    () => passengerDates.filter((d) => (!from || d >= from) && (!to || d <= to)).length,
    [passengerDates, from, to]
  )
  const margin = profitMargin(totalIncome, totalExpense)

  if (loading) {
    return <main className="max-w-2xl mx-auto px-4 py-6 text-gray-400 dark:text-gray-500">Loading…</main>
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
          Vessels
        </Link>
        <p className="text-gray-400 dark:text-gray-500">Vessel not found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/vessels"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Vessels
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{vessel.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {formatMVR(totalIncome)} in · {formatMVR(totalExpense)} out ·{' '}
          <span
            className={
              totalIncome - totalExpense >= 0
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-red-600 dark:text-red-400 font-medium'
            }
          >
            {formatMVR(totalIncome - totalExpense)} net
          </span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {margin == null ? '—' : formatPercent(margin)} margin
          {totalPassengers > 0 && ` · ${totalPassengers.toLocaleString()} passengers`}
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Ledger</h2>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
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
