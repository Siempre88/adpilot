'use client'

import { useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  AlertTriangle, TrendingUp, Eye, Clock, Pause, Palette, Target, ChevronDown,
  DollarSign, ExternalLink, TrendingDown,
} from 'lucide-react'
import type { CampaignWithMetrics, RecommendationAction, RecommendationConfidence } from '@/shared/types/database'

const buckets = [
  { key: 'urgent', label: 'Urgente', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/20' },
  { key: 'scale', label: 'Escalar', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/20' },
  { key: 'monitor', label: 'Vigilar', icon: Eye, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20' },
  { key: 'wait', label: 'Esperar', icon: Clock, color: 'text-zinc-500', bg: 'bg-zinc-400/10', border: 'border-zinc-700' },
] as const

const actionIcons: Record<RecommendationAction, typeof TrendingUp> = {
  SCALE: TrendingUp, MONITOR: Eye, PAUSE: Pause,
  REVIEW_CREATIVE: Palette, REVIEW_TARGETING: Target, WAIT: Clock,
  FIX_LANDING: ExternalLink, REDUCE_BUDGET: TrendingDown,
}

const confDots: Record<RecommendationConfidence, { n: number; color: string }> = {
  high: { n: 3, color: 'bg-green-400' }, medium: { n: 2, color: 'bg-yellow-400' }, low: { n: 1, color: 'bg-zinc-500' },
}

function Dots({ c }: { c: RecommendationConfidence }) {
  const d = confDots[c]
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map(i => <div key={i} className={cn('h-1 w-1 rounded-full', i <= d.n ? d.color : 'bg-zinc-700')} />)}
    </div>
  )
}

function ImpactBadge({ value, type }: { value: number; type: string }) {
  if (value <= 0) return null
  const isLoss = type === 'loss_prevention'
  return (
    <span className={cn('flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold',
      isLoss ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400')}>
      <DollarSign className="h-2.5 w-2.5" />
      {isLoss ? '-' : '+'}{value.toFixed(2)}/día
    </span>
  )
}

interface DecisionCenterProps {
  campaigns: CampaignWithMetrics[]
}

export function DecisionCenter({ campaigns }: DecisionCenterProps) {
  const [activeBucket, setActiveBucket] = useState<string>('urgent')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const withData = campaigns.filter(c => c.total_spend > 0 || c.recommendation?.action !== 'WAIT')

  const bucketData = buckets.map(b => {
    const camps = withData.filter(c => {
      if (!c.recommendation) return false
      if (b.key === 'urgent') return c.recommendation.priority === 'urgent' || c.recommendation.priority === 'risk'
      if (b.key === 'scale') return c.recommendation.action === 'SCALE' && c.recommendation.priority !== 'urgent' && c.recommendation.priority !== 'risk'
      if (b.key === 'monitor') return c.recommendation.action === 'MONITOR'
      return c.recommendation.action === 'WAIT'
    }).sort((a, b) => (b.impact?.value || 0) - (a.impact?.value || 0))
    const totalImpact = camps.reduce((s, c) => s + (c.impact?.value || 0), 0)
    return { ...b, campaigns: camps, totalImpact }
  })

  const active = bucketData.find(b => b.key === activeBucket)

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] px-4 pt-4 pb-0">
        <h3 className="mr-3 text-sm font-semibold text-white tracking-tight">Decisiones</h3>
        {bucketData.map(b => (
          <button key={b.key} onClick={() => { setActiveBucket(b.key); setExpandedId(null) }}
            className={cn('flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-all',
              activeBucket === b.key ? `${b.color} border-current` : 'text-zinc-500 border-transparent hover:text-zinc-300')}>
            <b.icon className="h-3.5 w-3.5" />
            {b.label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
              activeBucket === b.key ? b.bg : 'bg-white/[0.06]')}>
              {b.campaigns.length}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Impact summary for active bucket */}
        {active && active.totalImpact > 0 && (
          <div className={cn('mb-3 flex items-center justify-between rounded-lg px-3 py-2', active.bg)}>
            <span className={cn('text-[11px] font-medium', active.color)}>
              Impacto estimado de este grupo
            </span>
            <span className={cn('text-sm font-bold', active.color)}>
              {formatCurrency(active.totalImpact)}/día
            </span>
          </div>
        )}

        {active && active.campaigns.length > 0 ? (
          <div className="space-y-1.5">
            {active.campaigns.slice(0, 5).map(c => {
              const rec = c.recommendation
              if (!rec) return null
              const Icon = actionIcons[rec.action]
              const isExp = expandedId === c.id

              return (
                <div key={c.id} className={cn('rounded-lg border transition-all',
                  isExp ? `${active.border} bg-zinc-800/30` : 'border-zinc-800/50 hover:border-zinc-700')}>
                  <button onClick={() => setExpandedId(isExp ? null : c.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold',
                      c.score >= 70 ? 'bg-green-400/10 text-green-400' : c.score >= 45 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-red-400/10 text-red-400')}>
                      {c.score}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{c.name}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        CTR {c.avg_ctr.toFixed(1)}% · CPC ${c.avg_cpc.toFixed(2)} · ${c.total_spend.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.impact && <ImpactBadge value={c.impact.value} type={c.impact.type} />}
                      <Icon className={cn('h-3 w-3', active.color)} />
                      <Dots c={rec.confidence} />
                      <ChevronDown className={cn('h-3 w-3 text-zinc-600 transition-transform', isExp && 'rotate-180')} />
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t border-zinc-800/50 px-3 py-2.5 space-y-2">
                      {rec.explanation && (
                        <div>
                          <p className={cn('text-[11px] font-semibold', active.color)}>{rec.explanation.headline}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{rec.explanation.reason}</p>
                        </div>
                      )}
                      {c.impact && c.impact.value > 0 && (
                        <div className="rounded bg-zinc-800/50 px-2.5 py-1.5">
                          <p className="text-[10px] font-medium text-zinc-300">
                            Proyección: {c.impact.description}
                          </p>
                        </div>
                      )}
                      {rec.explanation && (
                        <div className="flex flex-wrap gap-1">
                          {rec.explanation.trigger_metrics.map((m, i) => (
                            <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {active.campaigns.length > 5 && (
              <p className="pt-1 text-center text-[10px] text-zinc-600">+{active.campaigns.length - 5} más</p>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-zinc-600">Sin campañas en esta categoría</p>
        )}
      </div>
    </div>
  )
}
