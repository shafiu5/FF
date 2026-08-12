'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OmitRule } from '@/lib/types'
import { SkeletonList } from '@/components/Skeleton'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [rules, setRules] = useState<OmitRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [reference, setReference] = useState('')
  const [contact, setContact] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [taxPercentInput, setTaxPercentInput] = useState('0')
  const [savingTax, setSavingTax] = useState(false)
  const [taxError, setTaxError] = useState<string | null>(null)
  const [taxSaved, setTaxSaved] = useState(false)

  const [signingOut, setSigningOut] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [rulesRes, settingsRes] = await Promise.all([
        supabase.from('omit_rules').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('tax_percent').eq('id', true).maybeSingle(),
      ])
      if (rulesRes.error) throw rulesRes.error
      if (settingsRes.error) throw settingsRes.error
      setRules((rulesRes.data as OmitRule[]) ?? [])
      setTaxPercentInput(String(settingsRes.data?.tax_percent ?? 0))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveTaxPercent(e: FormEvent) {
    e.preventDefault()
    setSavingTax(true)
    setTaxError(null)
    setTaxSaved(false)
    const { error } = await supabase
      .from('app_settings')
      .update({ tax_percent: Number(taxPercentInput), updated_at: new Date().toISOString() })
      .eq('id', true)
    setSavingTax(false)
    if (error) {
      setTaxError(error.message)
      return
    }
    setTaxSaved(true)
  }

  async function addRule(e: FormEvent) {
    e.preventDefault()
    if (!reference.trim() && !contact.trim()) {
      setError('Enter a reference or a contact number.')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('omit_rules')
      .insert({ reference: reference.trim(), contact: contact.trim(), label })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setReference('')
    setContact('')
    setLabel('')
    load()
  }

  async function removeRule(id: string) {
    await supabase.from('omit_rules').delete().eq('id', id)
    load()
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section>
        <h2 className="font-semibold mb-1">Tax rate</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Used when you mark an expense as having tax — the tax value is calculated from this rate.
        </p>
        <form
          onSubmit={saveTaxPercent}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-end gap-3"
        >
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tax percent (%)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxPercentInput}
              onChange={(e) => {
                setTaxPercentInput(e.target.value)
                setTaxSaved(false)
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
          </div>
          <button
            disabled={savingTax}
            className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {savingTax ? 'Saving…' : 'Save'}
          </button>
        </form>
        {taxError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{taxError}</p>}
        {taxSaved && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Tax rate updated.</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-1">Tax-free omit list</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          When importing income from Excel, any row whose reference/invoice number or contact
          matches one saved here is automatically flagged tax-free (it&apos;s still imported, never
          dropped).
        </p>
        <form
          onSubmit={addRule}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 mb-3"
        >
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference / invoice number"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Contact / phone number"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. what this is)"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {saving ? 'Saving…' : 'Add to omit list'}
          </button>
        </form>

        {loading ? (
          <SkeletonList rows={3} withHeading={false} />
        ) : loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No saved references yet.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
              >
                <div>
                  <p className="font-medium">
                    {[r.reference, r.contact].filter(Boolean).join(' · ') || 'Untitled'}
                  </p>
                  {r.label && <p className="text-xs text-gray-400 dark:text-gray-500">{r.label}</p>}
                </div>
                <button
                  onClick={() => removeRule(r.id)}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 -m-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50"
                  aria-label="Remove"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 py-2 font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-50"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </main>
  )
}
