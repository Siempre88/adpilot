'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ArrowRight, Pause, TrendingUp, Palette, Target, ExternalLink, TrendingDown, Eye, Clock,
} from 'lucide-react'
import type { RecommendationAction, RecommendationConfidence, RecommendationUrgency } from '@/shared/types/database'
import type { TodayAction } from '../types'

const ACTION_META: Record<RecommendationAction, {
  verb: string
  icon: typeof Pause
  tint: string         // glass tint class
  iconColor: string
  short: string        // short label for the badge
}> = {
  PAUSE:            { verb: 'Pausa',           icon: Pause,        tint: 'glass-danger',  iconColor: 'text-red-300',    short: 'PAUSAR' },
  SCALE:            { verb: 'Escala',          icon: TrendingUp,   tint: 'glass-success', iconColor: 'text-emerald-300', short: 'ESCALAR' },
  REVIEW_CREATIVE:  { verb: 'Cambia creativo', icon: Palette,      tint: 'glass-accent',  iconColor: 'text-purple-300', short: 'CREATIVO' },
  REVIEW_TARGETING: { verb: 'Revisa segmentación', icon: Target,   tint: 'glass-warning', iconColor: 'text-amber-300',  short: 'TARGETING' },
  FIX_LANDING:      { verb: 'Revisa landing',  icon: ExternalLink, tint: 'glass-warning', iconColor: 'text-amber-300',  short: 'LANDING' },
  REDUCE_BUDGET:    { verb: 'Baja budget',     icon: TrendingDown, tint: 'glass-danger',  iconColor: 'text-red-300',    short: 'BAJAR $' },
  MONITOR:          { verb: 'Vigila',          icon: Eye,          tint: 'glass',         iconColor: 'text-blue-300',   short: 'VIGILAR' },
  WAIT:             { verb: 'Espera',          icon: Clock,        tint: 'glass',         iconColor: 'text-zinc-400',   short: 'ESPERAR' },
}

const URGENCY_META: Record<RecommendationUrgency, { label: string; color: string }> = {
  now:        { label: 'Ahora',     color: 'text-red-300' },
  today:      { label: 'Hoy',       color: 'text-amber-300' },
  this_week:  { label: 'Esta semana', color: 'text-blue-300' },
  no_rush:    { label: 'Sin prisa', color: 'text-zinc-400' },
}

const CONFIDENCE_META: Record<RecommendationConfidence, { label: string; dots: number; color: string }> = {
  high:   { label: 'Alta',  dots: 3, color: 'bg-emerald-400' },
  medium: { label: 'Media', dots: 2, color: 'bg-amber-400' },
  low:    { label: 'Baja',  dots: 1, color: 'bg-zinc-500' },
}

export function ActionCard({ action, index }: { action: TodayAction; index: number }) {
  const meta = ACTION_META[action.action]
  const urgency = URGENCY_META[action.urgency]
  const conf = CONFIDENCE_META[action.confidence]
  const Icon = meta.icon

  return (
    <article className={cn('relative overflow-hidden rounded-2xl p-5 transition-colors', meta.tint, 'glass-hover')}>
      {/* Step number */}
      <div className="absolute right-4 top-4 text-[10px] font-bold tracking-widest text-white/30">
        #{index + 1}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.06]')}>
          <Icon className={cn('h-5 w-5', meta.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-widest', 'border border-white/[0.10] bg-white/[0.06]', meta.iconColor)}>
              {meta.short}
            </span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', urgency.color)}>
              · {urgency.label}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-bold text-white sm:text-base">
            {meta.verb} <span className="text-white/90">{action.campaign_name}</span>
          </h3>
        </div>
      </div>

      {/* Reason */}
      <p className="mt-4 text-xs leading-relaxed text-white/70">{action.reason}</p>

      {/* Impact */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Impacto</p>
          <p className={cn(
            'text-sm font-bold tabular-nums',
            action.impact_type === 'loss_prevention' ? 'text-red-300' : 'text-emerald-300'
          )}>
            {action.impact_description}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/40">{conf.label}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn('h-1 w-1 rounded-full', i <= conf.dots ? conf.color : 'bg-zinc-700')} />
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/campaigns?id=${encodeURIComponent(action.campaign_id)}`}
        className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.10] bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.10]"
      >
        Ver detalle de campaña
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  )
}
