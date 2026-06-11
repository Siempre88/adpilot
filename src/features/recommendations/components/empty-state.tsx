'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ShieldCheck, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import type { RecommendationsEmpty } from '../types'

export function EmptyState({ data }: { data: RecommendationsEmpty }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.ok === false) {
        setError(json.error || 'No se pudo sincronizar')
        setSyncing(false)
        return
      }
      router.refresh()
    } catch {
      setError('Error de red al sincronizar')
      setSyncing(false)
    }
  }

  if (data.reason === 'all_stable') {
    return (
      <Hero
        icon={ShieldCheck}
        tone="success"
        title="Todo estable hoy"
        message={data.message}
        cta={
          <Link
            href="/today"
            className="btn-glass mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Ir a Today <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    )
  }

  return (
    <Hero
      icon={RefreshCw}
      tone="warning"
      title="Sin datos suficientes"
      message={data.message}
      cta={
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-glass mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
      }
      footer={error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    />
  )
}

function Hero({
  icon: Icon,
  tone,
  title,
  message,
  cta,
  footer,
}: {
  icon: typeof RefreshCw
  tone: 'success' | 'warning'
  title: string
  message: string
  cta?: React.ReactNode
  footer?: React.ReactNode
}) {
  const tint = tone === 'success' ? 'glass-success' : 'glass-warning'
  const iconColor = tone === 'success' ? 'text-emerald-300' : 'text-amber-300'

  return (
    <div className={cn('relative overflow-hidden rounded-2xl p-8 text-center', tint)}>
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>
      <div className="relative">
        <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.06]')}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/60">{message}</p>
        {cta}
        {footer}
      </div>
    </div>
  )
}
