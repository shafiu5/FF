'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-900 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-sky-600 dark:text-sky-400 text-center mb-1">
          Set a new password
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Choose a password to finish signing in.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 text-white py-3 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
      </div>
    </main>
  )
}
