'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { Vessel } from '@/lib/types'
import { currentMonthRange, toISODate } from '@/lib/dateRange'
import { formatPercent, profitMargin } from '@/lib/margin'
import Skeleton from '@/components/Skeleton'

type ExpenseRow = { vessel_id: string | null; amount: number; expense_date: string }
type IncomeRow = { vessel_id: string | null; amount: number; income_date: string; is_tax_free: boolean }
type FuelCostRow = { vessel_id: string; cost: number | null; filled_at: string }
type PassengerTotalRow = { vessel_id: string | null; income_date: string; passenger_count: number }

// Data entered before this date is known to be incomplete/incorrect, so the
// projection's daily run-rate is only averaged from here forward.
const PROJECTION_BASIS_START = '2026-08-01'

export default function DashboardPage() {
  const supabase = createClient()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
  const [passengerTotals, setPassengerTotals] = useState<PassengerTotalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, expensesRes, incomeRes, fuelRes, passengerLinesRes] = await Promise.all([
        supabase.from('vessels').select('id, name, notes, created_at').order('name'),
        supabase.from('expenses').select('vessel_id, amount, expense_date'),
        supabase.from('income_entries').select('vessel_id, amount, income_date, is_tax_free'),
        supabase.from('fuel_entry_cost').select('vessel_id, cost, filled_at'),
        supabase.from('income_entry_line_totals').select('vessel_id, income_date, passenger_count'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (fuelRes.error) throw fuelRes.error
      if (passengerLinesRes.error) throw passengerLinesRes.error
      setVessels((vesselsRes.data as Vessel[]) ?? [])
      setExpenses((expensesRes.data as ExpenseRow[]) ?? [])
      setIncome((incomeRes.data as IncomeRow[]) ?? [])
      setFuelCosts((fuelRes.data as FuelCostRow[]) ?? [])
      setPassengerTotals((passengerLinesRes.data as PassengerTotalRow[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => (!from || e.expense_date >= from) && (!to || e.expense_date <= to)),
    [expenses, from, to]
  )
  const filteredIncome = useMemo(
    () => income.filter((i) => (!from || i.income_date >= from) && (!to || i.income_date <= to)),
    [income, from, to]
  )
  const filteredFuel = useMemo(
    () =>
      fuelCosts.filter(
        (f) => f.cost != null && (!from || f.filled_at >= from) && (!to || f.filled_at <= to)
      ),
    [fuelCosts, from, to]
  )

  const filteredPassengerTotals = useMemo(
    () => passengerTotals.filter((t) => (!from || t.income_date >= from) && (!to || t.income_date <= to)),
    [passengerTotals, from, to]
  )
  const totalPassengers = useMemo(
    () => filteredPassengerTotals.reduce((sum, t) => sum + t.passenger_count, 0),
    [filteredPassengerTotals]
  )

  const totalIncome = useMemo(() => filteredIncome.reduce((s, i) => s + i.amount, 0), [filteredIncome])
  const taxFreeIncome = useMemo(
    () => filteredIncome.filter((i) => i.is_tax_free).reduce((s, i) => s + i.amount, 0),
    [filteredIncome]
  )
  const manualExpenseTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses])
  const fuelExpenseTotal = useMemo(() => filteredFuel.reduce((s, f) => s + (f.cost ?? 0), 0), [filteredFuel])
  const totalExpense = manualExpenseTotal + fuelExpenseTotal
  const net = totalIncome - totalExpense
  const fleetMargin = profitMargin(totalIncome, totalExpense)

  type VesselTotal = {
    id: string
    name: string
    income: number
    expense: number
    passengers: number
    isUnassigned: boolean
  }

  const perVessel = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; passengers: number }>()
    for (const v of vessels) map.set(v.id, { expense: 0, income: 0, passengers: 0 })
    const unassigned = { expense: 0, income: 0, passengers: 0 }
    for (const e of filteredExpenses) {
      if (!e.vessel_id) {
        unassigned.expense += e.amount
        continue
      }
      const t = map.get(e.vessel_id)
      if (t) t.expense += e.amount
    }
    for (const f of filteredFuel) {
      const t = map.get(f.vessel_id)
      if (t) t.expense += f.cost ?? 0
    }
    for (const i of filteredIncome) {
      if (!i.vessel_id) {
        unassigned.income += i.amount
        continue
      }
      const t = map.get(i.vessel_id)
      if (t) t.income += i.amount
    }
    for (const t of filteredPassengerTotals) {
      if (!t.vessel_id) {
        unassigned.passengers += t.passenger_count
        continue
      }
      const entry = map.get(t.vessel_id)
      if (entry) entry.passengers += t.passenger_count
    }
    const rows: VesselTotal[] = vessels.map((v) => ({
      id: v.id,
      name: v.name,
      isUnassigned: false,
      ...map.get(v.id)!,
    }))
    if (unassigned.income !== 0 || unassigned.expense !== 0 || unassigned.passengers !== 0) {
      rows.push({ id: '__unassigned', name: 'Unassigned', isUnassigned: true, ...unassigned })
    }
    return rows.sort((a, b) => b.income - b.expense - (a.income - a.expense))
  }, [vessels, filteredExpenses, filteredFuel, filteredIncome, filteredPassengerTotals])

  // Daily run-rate used for the projection: total income/expense from
  // PROJECTION_BASIS_START through today, divided by however many days
  // that spans — independent of whatever date range is filtered above.
  const projectionBasis = useMemo(() => {
    const todayISO = toISODate(new Date())
    const start = PROJECTION_BASIS_START
    const end = todayISO < start ? start : todayISO
    const incomeSum = income
      .filter((i) => i.income_date >= start && i.income_date <= end)
      .reduce((s, i) => s + i.amount, 0)
    const expenseSum =
      expenses
        .filter((e) => e.expense_date >= start && e.expense_date <= end)
        .reduce((s, e) => s + e.amount, 0) +
      fuelCosts
        .filter((f) => f.filled_at >= start && f.filled_at <= end)
        .reduce((s, f) => s + (f.cost ?? 0), 0)
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const dayCount =
      Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000) + 1
    return { avgIncome: incomeSum / dayCount, avgExpense: expenseSum / dayCount }
  }, [income, expenses, fuelCosts])

  // One month of projected days right after the selected range, so the
  // projected line picks up exactly where the actual line ends.
  const projectionWindow = useMemo(() => {
    if (!to) return null
    const [ty, tm, td] = to.split('-').map(Number)
    const start = new Date(ty, tm - 1, td)
    start.setDate(start.getDate() + 1)
    // "One month" measured from `start`, not from `to` — doing the +1
    // month math on the 31st (say) would overflow into the month after
    // next since not every month has 31 days.
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(end.getDate() - 1)
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    return { start, end, days }
  }, [to])

  const projectedNextMonth = useMemo(() => {
    if (!projectionWindow) return null
    return (projectionBasis.avgIncome - projectionBasis.avgExpense) * projectionWindow.days
  }, [projectionWindow, projectionBasis])

  const daily = useMemo(() => {
    type DailyPoint = {
      date: string
      income?: number
      expense?: number
      projIncome?: number
      projExpense?: number
    }
    const map = new Map<string, DailyPoint>()
    function bucket(date: string) {
      const day = date.slice(0, 10)
      if (!map.has(day)) map.set(day, { date: day, income: 0, expense: 0 })
      return map.get(day)!
    }
    for (const i of filteredIncome) bucket(i.income_date).income! += i.amount
    for (const e of filteredExpenses) bucket(e.expense_date).expense! += e.amount
    for (const f of filteredFuel) bucket(f.filled_at).expense! += f.cost ?? 0
    // Zero-fill every day in the selected range so a day with no
    // transactions shows as a gap in the line, not a skipped x-axis step
    // that quietly compresses the timeline.
    if (from && to) {
      const [fy, fm, fd] = from.split('-').map(Number)
      const [ty, tm, td] = to.split('-').map(Number)
      for (let d = new Date(fy, fm - 1, fd); d <= new Date(ty, tm - 1, td); d.setDate(d.getDate() + 1)) {
        bucket(toISODate(d))
      }
      // Bridge point: give the last actual day a projected value too, equal
      // to its actual value, so the dashed projected line starts exactly
      // where the solid actual line ends instead of jumping in with a gap.
      const lastActual = map.get(to)
      if (lastActual) {
        lastActual.projIncome = lastActual.income
        lastActual.projExpense = lastActual.expense
      }
    }
    if (projectionWindow) {
      for (let d = new Date(projectionWindow.start); d <= projectionWindow.end; d.setDate(d.getDate() + 1)) {
        const day = toISODate(d)
        map.set(day, {
          date: day,
          projIncome: projectionBasis.avgIncome,
          projExpense: projectionBasis.avgExpense,
        })
      }
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [filteredIncome, filteredExpenses, filteredFuel, from, to, projectionWindow, projectionBasis])

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-56 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
              <div className="p-4">
                <Skeleton className="h-10" />
              </div>
              <div className="p-4">
                <Skeleton className="h-10" />
              </div>
              <div className="p-4">
                <Skeleton className="h-10" />
              </div>
            </div>
          </div>
        </div>
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
        <>
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Income</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMVR(totalIncome)}</p>
              {taxFreeIncome > 0 && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatMVR(taxFreeIncome)} tax-free</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="font-semibold text-red-600 dark:text-red-400">{formatMVR(totalExpense)}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">incl. {formatMVR(fuelExpenseTotal)} fuel</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Net</p>
              <p className={`font-semibold ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatMVR(net)}
              </p>
              {projectedNextMonth != null && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Next month (projected): {formatMVR(projectedNextMonth)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Profit margin (fleet)</p>
              <p
                className={`font-semibold ${
                  fleetMargin == null
                    ? 'text-gray-400 dark:text-gray-500'
                    : fleetMargin >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
              >
                {fleetMargin == null ? '—' : formatPercent(fleetMargin)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Passengers</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{totalPassengers.toLocaleString()}</p>
            </div>
          </div>

          {daily.length > 0 && (
            <div className="h-56 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-neutral-800" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d: string) => {
                      const [, m, day] = d.split('-')
                      return `${Number(m)}/${Number(day)}`
                    }}
                    minTickGap={16}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatMVR(v)} labelFormatter={(d: string) => d} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#059669"
                    name="Income"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="#dc2626"
                    name="Expense"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projIncome"
                    stroke="#059669"
                    strokeOpacity={0.6}
                    name="Income (projected)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="projExpense"
                    stroke="#dc2626"
                    strokeOpacity={0.6}
                    name="Expense (projected)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <section>
            <h2 className="font-semibold mb-2">By vessel</h2>
            {perVessel.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No vessels yet.</p>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                {perVessel.map(({ id, name, income, expense, passengers, isUnassigned }) => {
                  const margin = profitMargin(income, expense)
                  const row = (
                    <>
                      <div>
                        <p className={`font-medium ${isUnassigned ? 'text-gray-500 dark:text-gray-400 italic' : ''}`}>
                          {name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {margin == null ? '—' : formatPercent(margin)} margin
                          {passengers > 0 && ` · ${passengers.toLocaleString()} passengers`}
                        </p>
                      </div>
                      <span
                        className={`font-medium ${income - expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {formatMVR(income - expense)}
                      </span>
                    </>
                  )
                  return isUnassigned ? (
                    <div key={id} className="flex items-center justify-between px-4 py-3 text-sm">
                      {row}
                    </div>
                  ) : (
                    <Link
                      key={id}
                      href={`/vessels/${id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60 active:bg-gray-100 dark:active:bg-neutral-800"
                    >
                      {row}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
