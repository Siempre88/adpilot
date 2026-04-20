'use client'

import { cn, formatCurrency } from '@/lib/utils'
import {
  AlertTriangle, TrendingUp, ShieldAlert, Eye, Pause, Palette, Target, Clock,
} from 'lucide-react'
import type { DailyPriority, RecommendationAction } from '@/shared/types/database'

const typeConfig = {
  urgent: { label: 'Urgente', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/15' },
  opportunity: { label: 'Oportunidad', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/15' },
  risk: { label: 'Riesgo', icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/15' },
  watch: { label: 'Observar', icon: Eye, color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-700' },
}

const actionLabels: Record<RecommendationAction, string> = {
  SCALE: 'Escalar', MONITOR: 'Vigilar', PAUSE: 'Pausar',
  REVIEW_CREATIVE: 'Creativo', REVIEW_TARGETING: 'Segmentación', WAIT: 'Esperar',
}

interface DailyPrioritiesProps {
  priorities: DailyPriority[]
}

export function DailyPriorities({ priorities }: DailyPrioritiesProps) {
  if (priorities.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Prioridades</h3>
        <p className="text-xs text-zinc-500">Todo bajo control.</p>
      </div>
    )
  }

  const totalImpact = priorities.reduce((s, p) => s + (p.impact_value || 0), 0)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Prioridades</h3>
        {totalImpact > 0 && (
          <span className="text-[10px] font-medium text-blue-400">{formatCurrency(totalImpact)}/día en juego</span>
        )}
      </div>
      <div className="space-y-2">
        {priorities.slice(0, 4).map((p, i) => {
          const config = typeConfig[p.type]
          const TypeIcon = config.icon
          const isFirst = i === 0

          return (
            <div key={i} className={cn('rounded-xl border p-3 transition-all', config.border, isFirst ? config.bg : 'bg-white/[0.02] hover:bg-white/[0.04]')}>
              <div className="flex items-start gap-2.5">
                <TypeIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.color)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[9px] font-bold uppercase tracking-wider', config.color)}>{config.label}</span>
                      <span className="rounded bg-zinc-800 px-1 py-0.5 text-[8px] font-medium text-zinc-500">{actionLabels[p.action]}</span>
                    </div>
                    {p.impact_value > 0 && (
                      <span className={cn('text-[10px] font-bold', config.color)}>
                        ${p.impact_value.toFixed(2)}/día
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-white">{p.campaign_name}</p>
                  {p.impact_description && (
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{p.impact_description}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
