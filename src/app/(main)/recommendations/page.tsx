'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { RecommendationsHeader } from '@/features/recommendations/components/recommendations-header'
import { RecommendationsSummary } from '@/features/recommendations/components/recommendations-summary'
import { RecommendationFilters } from '@/features/recommendations/components/recommendation-filters'
import { RecommendationCard } from '@/features/recommendations/components/recommendation-card'
import { EmptyState } from '@/features/recommendations/components/empty-state'
import type { RecommendationFilter, RecommendationsResponse } from '@/features/recommendations/types'

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RecommendationFilter>('all')
  const [showReviewed, setShowReviewed] = useState(false)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recommendations', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'No se pudo cargar')
        return
      }
      setData(json as RecommendationsResponse)
      setReviewedIds(new Set())
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!data || data.state !== 'loaded') return []
    return data.recommendations.filter(r => {
      const isReviewed = !!r.reviewed_at || reviewedIds.has(r.id)
      if (!showReviewed && isReviewed) return false
      if (filter !== 'all' && r.action !== filter) return false
      return true
    })
  }, [data, filter, showReviewed, reviewedIds])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <RecommendationsHeader />
        <div className="glass-danger rounded-2xl p-6 text-center">
          <p className="text-sm text-red-200">{error}</p>
          <button onClick={load} className="btn-glass mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  if (data.state === 'empty') {
    return (
      <div className="space-y-6">
        <RecommendationsHeader />
        <EmptyState data={data} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <RecommendationsHeader />
      <RecommendationsSummary summary={data.summary} />

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RecommendationFilters
          options={data.filters}
          active={filter}
          onChange={setFilter}
        />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={e => setShowReviewed(e.target.checked)}
            className="h-3 w-3 cursor-pointer accent-blue-400"
          />
          Mostrar revisadas
        </label>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-white/60">
            {filter === 'all' ? 'No hay recomendaciones pendientes con este filtro.' : 'Sin recomendaciones de este tipo.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onReviewed={(id) => setReviewedIds(prev => new Set(prev).add(id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
