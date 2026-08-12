'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Plus, X, Upload, Trash2, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMVR } from '@/lib/currency'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { IncomeEntryLine } from '@/lib/types'
import { computeIncomeTaxBreakdown } from '@/lib/tax'
import { matchesOmitRule } from '@/lib/xlsxImport'
import { currentMonthRange } from '@/lib/dateRange'
import Skeleton, { SkeletonList } from '@/components/Skeleton'

type VesselOption = { id: string; name: string }
type IncomeRow = {
  id: string
  vessel_id: string | null
  amount: number
  income_date: string
  reference: string
  description: string
  is_tax_free: boolean
  source: string
  vessels: { name: string } | null
  income_entry_lines: { count: number }[]
}

export default function IncomePage() {
  const supabase = createClient()
  const [vessels, setVessels] = useState<VesselOption[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [taxPercent, setTaxPercent] = useState(0)
  const [omitRules, setOmitRules] = useState<{ reference: string; contact: string }[]>([])
  const [lineTotals, setLineTotals] = useState<Record<string, { taxFreeAmount: number; taxableAmount: number }>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [vesselId, setVesselId] = useState('')
  const [amount, setAmount] = useState('')
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [isTaxFree, setIsTaxFree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVesselId, setEditVesselId] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editIsTaxFree, setEditIsTaxFree] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lines, setLines] = useState<Record<string, IncomeEntryLine[]>>({})
  const [loadingLines, setLoadingLines] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselsRes, incomeRes, settingsRes, omitRulesRes, lineTotalsRes] = await Promise.all([
        supabase.from('vessels').select('id, name').order('name'),
        supabase
          .from('income_entries')
          .select(
            'id, vessel_id, amount, income_date, reference, description, is_tax_free, source, vessels(name), income_entry_lines(count)'
          )
          .order('income_date', { ascending: false }),
        supabase.from('app_settings').select('tax_percent').eq('id', true).maybeSingle(),
        supabase.from('omit_rules').select('reference, contact'),
        supabase.from('income_entry_line_totals').select('income_entry_id, tax_free_amount, taxable_amount'),
      ])
      if (vesselsRes.error) throw vesselsRes.error
      if (incomeRes.error) throw incomeRes.error
      if (settingsRes.error) throw settingsRes.error
      if (omitRulesRes.error) throw omitRulesRes.error
      if (lineTotalsRes.error) throw lineTotalsRes.error
      setVessels((vesselsRes.data as VesselOption[]) ?? [])
      setIncome((incomeRes.data as unknown as IncomeRow[]) ?? [])
      setTaxPercent(settingsRes.data?.tax_percent ?? 0)
      setOmitRules((omitRulesRes.data as { reference: string; contact: string }[]) ?? [])
      const grouped: Record<string, { taxFreeAmount: number; taxableAmount: number }> = {}
      for (const l of (lineTotalsRes.data as
        | { income_entry_id: string; tax_free_amount: number; taxable_amount: number }[]
        | null) ?? []) {
        grouped[l.income_entry_id] = { taxFreeAmount: l.tax_free_amount, taxableAmount: l.taxable_amount }
      }
      setLineTotals(grouped)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load income.')
    } finally {
      setLoading(false)
    }
  }

  async function addIncome(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('income_entries').insert({
      vessel_id: vesselId || null,
      amount: Number(amount),
      income_date: incomeDate,
      reference,
      description,
      is_tax_free: isTaxFree,
      source: 'manual',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setVesselId('')
    setAmount('')
    setReference('')
    setDescription('')
    setIsTaxFree(false)
    setShowAdd(false)
    load()
  }

  async function deleteIncome(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('income_entries').delete().eq('id', id)
    setDeletingId(null)
    if (!error) setIncome((prev) => prev.filter((i) => i.id !== id))
  }

  function startEdit(entry: IncomeRow) {
    setEditingId(entry.id)
    setEditVesselId(entry.vessel_id ?? '')
    setEditDate(entry.income_date)
    setEditIsTaxFree(entry.is_tax_free)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id: string, hasLines: boolean) {
    setSavingEdit(true)
    setEditError(null)
    const update: { vessel_id: string | null; income_date: string; is_tax_free?: boolean } = {
      vessel_id: editVesselId || null,
      income_date: editDate,
    }
    if (!hasLines) update.is_tax_free = editIsTaxFree
    const { error } = await supabase.from('income_entries').update(update).eq('id', id)
    setSavingEdit(false)
    if (error) {
      setEditError(error.message)
      return
    }
    setEditingId(null)
    load()
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (lines[id]) return
    setLoadingLines(id)
    const { data, error } = await supabase
      .from('income_entry_lines')
      .select('id, income_entry_id, name, amount, reference, is_tax_free, created_at')
      .eq('income_entry_id', id)
      .order('created_at')
    setLoadingLines(null)
    if (!error) setLines((prev) => ({ ...prev, [id]: (data as IncomeEntryLine[]) ?? [] }))
  }

  const filtered = useMemo(
    () => income.filter((i) => (!from || i.income_date >= from) && (!to || i.income_date <= to)),
    [income, from, to]
  )

  const total = useMemo(() => filtered.reduce((sum, i) => sum + i.amount, 0), [filtered])
  const breakdowns = useMemo(
    () =>
      new Map(
        filtered.map((i) => [
          i.id,
          computeIncomeTaxBreakdown(i.amount, i.is_tax_free, lineTotals[i.id], taxPercent),
        ])
      ),
    [filtered, lineTotals, taxPercent]
  )
  const taxFreeTotal = useMemo(
    () => [...breakdowns.values()].reduce((sum, b) => sum + b.taxFreeAmount, 0),
    [breakdowns]
  )
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income</h1>
        <div className="flex gap-2">
          <Link
            href="/income/import"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
          >
            <Upload size={16} strokeWidth={1.75} />
            Import Excel
          </Link>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800"
          >
            {showAdd ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
            {showAdd ? 'Cancel' : 'Add income'}
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={addIncome}
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
          <input
            required
            type="date"
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <input
            value={reference}
            onChange={(e) => {
              const value = e.target.value
              setReference(value)
              if (matchesOmitRule(value, omitRules)) setIsTaxFree(true)
            }}
            placeholder="Reference / invoice number (optional)"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isTaxFree}
                onChange={(e) => setIsTaxFree(e.target.checked)}
                className="rounded border-gray-300 dark:border-neutral-700"
              />
              Tax-free
            </label>
            {matchesOmitRule(reference, omitRules) && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Matches your tax-free omit list — checked automatically.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {saving ? 'Saving…' : 'Save income'}
          </button>
        </form>
      )}

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {loading ? (
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
        <p className="text-sm text-gray-400 dark:text-gray-500">No income in this range.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: <span className="font-medium text-gray-900 dark:text-gray-100">{formatMVR(total)}</span>
            {taxFreeTotal > 0 && (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                ({formatMVR(taxFreeTotal)} tax-free)
              </span>
            )}
          </p>
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {filtered.map((i) => {
              const lineCount = i.income_entry_lines?.[0]?.count ?? 0
              const expanded = expandedId === i.id
              const breakdown = breakdowns.get(i.id)!
              return (
                <div key={i.id}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60 active:bg-gray-100 dark:active:bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => (lineCount > 0 ? toggleExpand(i.id) : undefined)}
                      className={`min-w-0 flex-1 flex items-start gap-1.5 text-left ${lineCount > 0 ? '' : 'cursor-default'}`}
                    >
                      {lineCount > 0 &&
                        (expanded ? (
                          <ChevronDown size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-gray-400" />
                        ))}
                      <span className="min-w-0">
                        <p className="font-medium flex items-center gap-1.5 flex-wrap">
                          {i.description || i.reference || 'Income'}
                          {i.is_tax_free && (
                            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded px-1.5 py-0.5">
                              Tax-free
                            </span>
                          )}
                          {lineCount > 0 && (
                            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                              {lineCount} passengers
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {i.income_date} · {i.vessels?.name ?? 'Unassigned'}
                          {i.reference && i.description ? ` · ${i.reference}` : ''}
                        </p>
                      </span>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-right">
                        <span className="font-medium block">{formatMVR(i.amount)}</span>
                        {breakdown.tax > 0 && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">
                            incl. {formatMVR(breakdown.tax)} tax
                          </span>
                        )}
                        {breakdown.taxFreeAmount > 0 && (
                          <span className="block text-xs text-emerald-600 dark:text-emerald-400">
                            {formatMVR(breakdown.taxFreeAmount)} tax-free
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => (editingId === i.id ? cancelEdit() : startEdit(i))}
                        className="text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-950/50"
                        aria-label="Edit date/vessel"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => deleteIncome(i.id)}
                        disabled={deletingId === i.id}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  {editingId === i.id && (
                    <div className="px-4 pb-3 pl-10 flex flex-wrap items-end gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Date</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Vessel</label>
                        <select
                          value={editVesselId}
                          onChange={(e) => setEditVesselId(e.target.value)}
                          className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {vessels.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {lineCount === 0 && (
                        <label className="flex items-center gap-1.5 text-sm pb-1.5">
                          <input
                            type="checkbox"
                            checked={editIsTaxFree}
                            onChange={(e) => setEditIsTaxFree(e.target.checked)}
                            className="rounded border-gray-300 dark:border-neutral-700"
                          />
                          Tax-free
                        </label>
                      )}
                      <button
                        onClick={() => saveEdit(i.id, lineCount > 0)}
                        disabled={savingEdit}
                        className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50"
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
                      >
                        Cancel
                      </button>
                      {editError && <p className="w-full text-xs text-red-600 dark:text-red-400">{editError}</p>}
                      {lineCount > 0 && (
                        <p className="w-full text-[11px] text-gray-400 dark:text-gray-500">
                          Tax-free status here comes from its {lineCount} passenger lines (expand the entry above
                          to view them), not this entry-level flag — re-import to fix individual passengers.
                        </p>
                      )}
                    </div>
                  )}
                  {expanded && (
                    <div className="px-4 pb-3 pl-10">
                      {loadingLines === i.id ? (
                        <Skeleton className="h-8" />
                      ) : (
                        <div className="rounded-lg border border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
                          {(lines[i.id] ?? []).map((l) => (
                            <div key={l.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">
                                {l.name || 'Passenger'}
                                {l.reference && <span className="text-gray-400 dark:text-gray-500"> · {l.reference}</span>}
                                {l.is_tax_free && (
                                  <span className="ml-1.5 text-[10px] font-normal text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded px-1 py-0.5">
                                    Tax-free
                                  </span>
                                )}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">{formatMVR(l.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
