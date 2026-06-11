'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/db/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Auto-login after signup (Supabase auto-confirms in dev)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (!loginError) {
      router.push('/onboarding')
      router.refresh()
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-green-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="glass-hero relative w-full max-w-sm rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/30">
            <CheckCircle2 className="h-8 w-8 text-green-300" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-white tracking-tight">Cuenta creada</h2>
          <p className="mt-2 text-sm text-white/60">Revisa tu email para confirmar tu cuenta.</p>
          <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">
            Ir a login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="logo-glow flex h-11 w-11 items-center justify-center rounded-2xl">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">AdPilot</span>
        </div>

        <div className="glass-hero rounded-3xl p-7">
          <h1 className="text-xl font-bold text-white tracking-tight">Crear cuenta</h1>
          <p className="mt-1 text-xs text-white/60">Empieza a analizar tus campañas con IA</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/70">Nombre</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/70">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/70">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
            </div>

            {error && (
              <div className="glass-danger flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-red-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-white/50">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-blue-300 hover:text-blue-200 transition-colors">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
