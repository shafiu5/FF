'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OmitRule, AccountCollaborator } from '@/lib/types'
import { SkeletonList } from '@/components/Skeleton'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [rules, setRules] = useState<OmitRule[]>([])
  const [collaborators, setCollaborators] = useState<AccountCollaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [userEmail, setUserEmail] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [myCollaboration, setMyCollaboration] = useState<{ owner_email: string; can_edit: boolean } | null>(null)

  const [reference, setReference] = useState('')
  const [contact, setContact] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaboratorCanEdit, setCollaboratorCanEdit] = useState(false)
  const [savingCollaborator, setSavingCollaborator] = useState(false)
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null)

  const [taxPercentInput, setTaxPercentInput] = useState('0')
  const [savingTax, setSavingTax] = useState(false)
  const [taxError, setTaxError] = useState<string | null>(null)
  const [taxSaved, setTaxSaved] = useState(false)

  const [signingOut, setSigningOut] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [userRes, rulesRes, settingsRes, collaboratorsRes, myCollabRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('omit_rules').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('tax_percent').maybeSingle(),
        supabase.from('account_collaborators').select('*').order('created_at', { ascending: false }),
        supabase.rpc('my_collaboration'),
      ])
      setUserEmail(userRes.data.user?.email ?? '')
      setNameInput((userRes.data.user?.user_metadata?.full_name as string) ?? '')
      if (rulesRes.error) throw rulesRes.error
      if (settingsRes.error) throw settingsRes.error
      if (collaboratorsRes.error) throw collaboratorsRes.error
      setRules((rulesRes.data as OmitRule[]) ?? [])
      setTaxPercentInput(String(settingsRes.data?.tax_percent ?? 0))
      setCollaborators((collaboratorsRes.data as AccountCollaborator[]) ?? [])
      // Non-fatal: my_collaboration() is new and may not exist yet if that
      // migration hasn't been run, and it's only used for a display hint.
      const collabRows = (myCollabRes.data as { owner_email: string; can_edit: boolean }[]) ?? []
      setMyCollaboration(myCollabRes.error ? null : (collabRows[0] ?? null))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveName(e: FormEvent) {
    e.preventDefault()
    setSavingName(true)
    setNameSaved(false)
    setNameError(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } })
    setSavingName(false)
    if (error) {
      setNameError(error.message)
      return
    }
    setNameSaved(true)
  }

  async function saveTaxPercent(e: FormEvent) {
    e.preventDefault()
    setSavingTax(true)
    setTaxError(null)
    setTaxSaved(false)
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { tax_percent: Number(taxPercentInput), updated_at: new Date().toISOString() },
        { onConflict: 'owner_id' }
      )
    setSavingTax(false)
    if (error) {
      setTaxError(error.message)
      return
    }
    setTaxSaved(true)
  }

  async function addCollaborator(e: FormEvent) {
    e.preventDefault()
    const email = collaboratorEmail.trim().toLowerCase()
    if (!email) return
    setSavingCollaborator(true)
    setCollaboratorError(null)
    const { error } = await supabase
      .from('account_collaborators')
      .insert({ collaborator_email: email, can_edit: collaboratorCanEdit })
    setSavingCollaborator(false)
    if (error) {
      setCollaboratorError(
        error.message.toLowerCase().includes('duplicate') ? 'Already added.' : error.message
      )
      return
    }
    setCollaboratorEmail('')
    setCollaboratorCanEdit(false)
    load()
  }

  async function removeCollaborator(id: string) {
    await supabase.from('account_collaborators').delete().eq('id', id)
    load()
  }

  async function toggleCollaboratorEdit(c: AccountCollaborator) {
    await supabase.from('account_collaborators').update({ can_edit: !c.can_edit }).eq('id', c.id)
    load()
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
        <h2 className="font-semibold mb-1">Profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          The login and account currently in use on this device.
        </p>
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
            <p className="font-medium">{userEmail || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account</p>
            <p className="font-medium">
              {myCollaboration
                ? `Viewing ${myCollaboration.owner_email}'s account — ${
                    myCollaboration.can_edit ? 'can edit' : 'view only'
                  }`
                : 'You own this account'}
            </p>
          </div>
          <form onSubmit={saveName} className="flex items-end gap-3 pt-1">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name (optional)</label>
              <input
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value)
                  setNameSaved(false)
                }}
                placeholder="Your name"
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
            </div>
            <button
              disabled={savingName}
              className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </form>
          {nameError && <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>}
          {nameSaved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Name updated.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-1">Collaborators</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Your data is private to your login by default. Add an email here to give that person
          access to your account — view-only by default, or tick &quot;Can edit&quot; to let them
          add/edit/delete too (e.g. someone who needs to log fuel entries on your behalf).
        </p>
        <form
          onSubmit={addCollaborator}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 mb-3"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={collaboratorEmail}
                onChange={(e) => setCollaboratorEmail(e.target.value)}
                placeholder="someone@example.com"
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
              />
            </div>
            <button
              disabled={savingCollaborator}
              className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
            >
              {savingCollaborator ? 'Adding…' : 'Add'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={collaboratorCanEdit}
              onChange={(e) => setCollaboratorCanEdit(e.target.checked)}
              className="rounded border-gray-300 dark:border-neutral-700"
            />
            Can edit (add/edit/delete, not just view)
          </label>
        </form>
        {collaboratorError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{collaboratorError}</p>}
        {collaborators.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No collaborators added yet.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {collaborators.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
              >
                <div>
                  <p className="font-medium">{c.collaborator_email}</p>
                  <button
                    onClick={() => toggleCollaboratorEdit(c)}
                    className={`text-xs rounded px-1.5 py-0.5 border transition-colors ${
                      c.can_edit
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {c.can_edit ? 'Can edit — click to make view-only' : 'View only — click to allow editing'}
                  </button>
                </div>
                <button
                  onClick={() => removeCollaborator(c.id)}
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
