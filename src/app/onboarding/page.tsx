'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/db/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, KeyRound, Loader2, AlertTriangle, CheckCircle2, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function OnboardingPage() {
  const [token, setToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)
  const router = useRouter()

  async function handleSkip() {
    setSkipping(true)
    const supabase = createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      await supabase.from('profiles').update({ onboarding_done: true }).eq('id', currentUser.id)
    }
    router.push('/today')
    router.refresh()
  }

  async function handleConnect(e: FormEvent) {
    e.preventDefault()
    if (!token.trim() || !accountId.trim()) { setError('Token y Account ID son requeridos'); return }
    if (!accountId.startsWith('act_')) { setError('Account ID debe empezar con act_'); return }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/settings/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), accountId: accountId.trim() }),
      })
      const data = await res.json()

      if (!data.ok) {
        setError(data.message || 'Error al conectar')
        setLoading(false)
        return
      }

      // Mark onboarding as done
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        await supabase.from('profiles').update({ onboarding_done: true }).eq('id', currentUser.id)
      }

      // Trigger first sync
      setSyncStatus('Sincronizando campañas...')
      await fetch('/api/sync', { method: 'POST' })
      setSyncStatus(null)

      router.push('/today')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-purple-600/15 blur-3xl" />

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="logo-glow mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <Zap className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-white tracking-tight">Conecta tu cuenta de Meta Ads</h1>
          <p className="mt-1.5 text-sm text-white/60">Último paso para empezar a analizar tus campañas</p>
        </div>

        {/* Steps */}
        <div className="glass mb-5 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white">Cómo obtener tu token:</h3>
          <ol className="mt-3 space-y-2.5 text-xs text-white/70">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/80 border border-blue-400/40 text-[10px] font-bold text-white">1</span>
              Ve a <span className="font-medium text-blue-300">developers.facebook.com/tools/explorer</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/80 border border-blue-400/40 text-[10px] font-bold text-white">2</span>
              Selecciona tu app y agrega el permiso <code className="rounded bg-white/[0.08] border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-blue-200">ads_read</code>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/80 border border-blue-400/40 text-[10px] font-bold text-white">3</span>
              Copia el <strong className="text-white">Access Token</strong> generado
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/80 border border-blue-400/40 text-[10px] font-bold text-white">4</span>
              Tu Account ID está en Ads Manager → formato <code className="rounded bg-white/[0.08] border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-blue-200">act_XXXXXXXXX</code>
            </li>
          </ol>
        </div>

        {/* Form */}
        <div className="glass-hero rounded-2xl p-6">
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/70">Access Token</label>
              <div className="relative">
                <input value={token} onChange={e => setToken(e.target.value)} required
                  type={showToken ? 'text' : 'password'}
                  placeholder="EAAYYL8CIY5YB..."
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 pr-10 font-mono text-xs text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
                <button type="button" onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/70">Ad Account ID</label>
              <input value={accountId} onChange={e => setAccountId(e.target.value)} required
                placeholder="act_212677000"
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 font-mono text-xs text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
            </div>

            {error && (
              <div className="glass-danger flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-red-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading || skipping}
              className="btn-glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {syncStatus || 'Conectando...'}</> : <><KeyRound className="h-4 w-4" /> Conectar cuenta</>}
            </button>
          </form>

          <button onClick={handleSkip} disabled={loading || skipping}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent py-2.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white/90 disabled:opacity-50">
            {skipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Saltar por ahora <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
          <p className="mt-2 text-center text-[10px] text-white/40">Podrás conectar Meta Ads desde Settings cuando quieras</p>
        </div>
      </div>
    </div>
  )
}
