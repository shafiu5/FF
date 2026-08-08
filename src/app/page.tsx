'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setInfo('Account created — check your email to confirm it, then log in below.')
    setMode('login')
    setPassword('')
    setConfirmPassword('')
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"')
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setInfo('Check your email for a link to set your password.')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-neutral-950 dark:to-neutral-900 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-sky-600 dark:text-sky-400 text-center mb-1">
          Vessel Finance
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Expenses and income per vessel
        </p>

        <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
                : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white'
                : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {mode === 'signup' && (
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 text-white py-3 font-medium transition-colors hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
          {mode === 'login' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
            >
              Forgot password?
            </button>
          )}
        </form>

        {info && (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 text-center">{info}</p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
      </div>
    </main>
  )
}
