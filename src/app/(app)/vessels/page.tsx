'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import type { Vessel } from '@/lib/types'
import DateRangeFilter from '@/components/DateRangeFilter'
import { currentMonthRange } from '@/lib/dateRange'

type ExpenseRow = { vessel_id: string | null; amount: number; expense_date: string }
type IncomeRow = { vessel_id: string | null; amount: number; income_date: string }
type FuelCostRow = { vessel_id: string; cost: number | null; filled_at: string }

export default function VesselsPage() {
  const supabase = createClient()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [fuelCosts, setFuelCosts] = useState<FuelCostRow[]>([])
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
      const [vesselsRes, expensesRes, incomeRes, fuelRes] = await Promise.all([
        supabase.from('vessels').select('id, name, notes, created_at').order('name'),
        supabase.from('expenses').select('vessel_id, amount, expense_date'),
        supabase.from('income_entries').select('vessel_id, amount, income_date'),
        supabase.from('fuel_entry_cost').select('vessel_id, cost, filled_at'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (expensesRes.error) throw expensesRes.error
      if (incomeRes.error) throw incomeRes.error
      if (fuelRes.error) throw fuelRes.error
      setVessels((vesselsRes.data as Vessel[]) ?? [])
      setExpenses((expensesRes.data as ExpenseRow[]) ?? [])
      setIncome((incomeRes.data as IncomeRow[]) ?? [])
      setFuelCosts((fuelRes.data as FuelCostRow[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load vessels.')
    } finally {
      setLoading(false)
    }
  }

  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)

  const totals = useMemo(() => {
    const map = new Map<string, { expense: number; income: number }>()
    for (const v of vessels) map.set(v.id, { expense: 0, income: 0 })
    const unassigned = { expense: 0, income: 0 }
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
    return { map, unassigned }
  }, [vessels, expenses, income, fuelCosts, from, to])

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Vessels</h1>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500">Loading…</p>
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
            const t = totals.map.get(v.id) ?? { expense: 0, income: 0 }
            const net = t.income - t.expense
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
                </div>
                <span
                  className={`font-medium ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {formatMVR(net)}
                </span>
              </Link>
            )
          })}
          {(totals.unassigned.income !== 0 || totals.unassigned.expense !== 0) && (
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400 italic">Unassigned</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatMVR(totals.unassigned.income)} in · {formatMVR(totals.unassigned.expense)} out
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
      )}
    </main>
  )
}
