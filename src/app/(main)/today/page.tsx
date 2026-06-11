'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowRight } from 'lucide-react'
import { TodayHeader } from '@/features/today/components/today-header'
import { ActionCard } from '@/features/today/components/action-card'
import { WinnersSection } from '@/features/today/components/winners-section'
import { RisksSection } from '@/features/today/components/risks-section'
import { AiSummary } from '@/features/today/components/ai-summary'
import { EmptyState } from '@/features/today/components/empty-state'
import type { TodayResponse } from '@/features/today/types'

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/today', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'No se pudo cargar Today')
        setLoading(false)
        return
      }
      setData(json as TodayResponse)
    } catch {
      setError('Error de red al cargar Today')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-danger rounded-2xl p-6 text-center">
        <p className="text-sm text-red-200">{error}</p>
        <button onClick={load} className="btn-glass mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  if (data.state === 'empty') {
    return <EmptyState data={data} onSynced={load} />
  }

  // Loaded state
  return (
    <div className="space-y-6">
      <TodayHeader header={data.header} />

      <AiSummary summary={data.ai_summary} />

      {/* Qué hacer hoy */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-white">Qué hacer hoy</h2>
          {data.header.total_actions > data.actions.length && (
            <span className="text-[10px] text-white/40">
              {data.header.total_actions - data.actions.length} más en Recommendations
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {data.actions.map((a, i) => (
            <ActionCard key={a.campaign_id + a.action} action={a} index={i} />
          ))}
        </div>
      </section>

      {data.winners.length > 0 && <WinnersSection winners={data.winners} />}

      {data.risks.length > 0 && <RisksSection risks={data.risks} />}
    </div>
  )
}
