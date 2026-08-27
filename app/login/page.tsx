'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WalletCards } from 'lucide-react'
import { signIn, signUp } from '@/lib/auth-client'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: authError } =
        mode === 'login'
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email.split('@')[0] })
      if (authError) {
        setError(authError.message || 'Something went wrong')
        return
      }
      router.push('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <ThemeToggle className="absolute right-4 top-4 rounded-lg border p-2.5 text-muted-foreground" />
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WalletCards />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">DD Finance Calculator</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your money, made clear.</p>
          </div>
        </div>

        <div className="mt-6 flex rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === 'signup' && (
            <label className="text-sm font-medium">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </label>
          )}
          <label className="text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </label>
          <label className="text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              placeholder="At least 8 characters"
            />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>
      </div>
    </main>
  )
}
