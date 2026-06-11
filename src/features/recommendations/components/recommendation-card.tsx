'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import {
  Pause, TrendingUp, Palette, Target, ExternalLink, TrendingDown, Eye, Clock,
  ChevronDown, Check, ArrowRight, Loader2,
} from 'lucide-react'
import type { RecommendationAction, RecommendationConfidence, RecommendationUrgency, SignalSeverity } from '@/shared/types/database'
import type { RecommendationDetail } from '../types'
import { RecommendationDetailPanel } from './recommendation-detail'

const ACTION_META: Record<RecommendationAction, {
  icon: typeof Pause
  tint: string
  iconColor: string
  short: string
}> = {
  PAUSE:            { icon: Pause,        tint: 'glass-danger',  iconColor: 'text-red-300',     short: 'PAUSAR' },
  SCALE:            { icon: TrendingUp,   tint: 'glass-success', iconColor: 'text-emerald-300', short: 'ESCALAR' },
  REVIEW_CREATIVE:  { icon: Palette,      tint: 'glass-accent',  iconColor: 'text-purple-300',  short: 'CREATIVO' },
  REVIEW_TARGETING: { icon: Target,       tint: 'glass-warning', iconColor: 'text-amber-300',   short: 'AUDIENCIA' },
  FIX_LANDING:      { icon: ExternalLink, tint: 'glass-warning', iconColor: 'text-amber-300',   short: 'LANDING' },
  REDUCE_BUDGET:    { icon: TrendingDown, tint: 'glass-danger',  iconColor: 'text-red-300',     short: 'BAJAR $' },
  MONITOR:          { icon: Eye,          tint: 'glass',         iconColor: 'text-blue-300',    short: 'VIGILAR' },
  WAIT:             { icon: Clock,        tint: 'glass',         iconColor: 'text-zinc-400',    short: 'ESPERAR' },
}

const URGENCY_META: Record<RecommendationUrgency, { label: string; color: string }> = {
  now:        { label: 'Ahora',     color: 'text-red-300' },
  today:      { label: 'Hoy',       color: 'text-amber-300' },
  this_week:  { label: 'Esta semana', color: 'text-blue-300' },
  no_rush:    { label: 'Sin prisa', color: 'text-zinc-400' },
}

const SEVERITY_BADGE: Record<SignalSeverity, { label: string; tone: string }> = {
  critical: { label: 'Crítica',  tone: 'bg-red-400/15 text-red-300 border-red-400/30' },
  high:     { label: 'Alta',     tone: 'bg-orange-400/15 text-orange-300 border-orange-400/30' },
  medium:   { label: 'Media',    tone: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  low:      { label: 'Baja',     tone: 'bg-blue-400/15 text-blue-300 border-blue-400/30' },
}

const CONFIDENCE_DOTS: Record<RecommendationConfidence, { dots: number; color: string; label: string }> = {
  high:   { dots: 3, color: 'bg-emerald-400', label: 'Alta'  },
  medium: { dots: 2, color: 'bg-amber-400',   label: 'Media' },
  low:    { dots: 1, color: 'bg-zinc-500',    label: 'Baja'  },
}

interface CardProps {
  rec: RecommendationDetail
  onReviewed: (id: string) => void
}

export function RecommendationCard({ rec, onReviewed }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const meta = ACTION_META[rec.action]
  const urgency = URGENCY_META[rec.urgency]
  const sev = SEVERITY_BADGE[rec.severity]
  const conf = CONFIDENCE_DOTS[rec.confidence]
  const Icon = meta.icon

  async function handleMarkReviewed(e: React.MouseEvent) {
    e.stopPropagation()
    if (rec.reviewed_at) return
    setMarking(true)
    try {
      const res = await fetch('/api/recommendations/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, reviewed: true }),
      })
      if (res.ok) onReviewed(rec.id)
    } finally {
      setMarking(false)
    }
  }

  return (
    <article className={cn('rounded-2xl transition-colors', meta.tint, rec.reviewed_at && 'opacity-60')}>
      {/* Collapsed header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.06]">
          <Icon className={cn('h-5 w-5', meta.iconColor)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-widest', 'border-white/[0.10] bg-white/[0.06]', meta.iconColor)}>
              {meta.short}
            </span>
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-widest', sev.tone)}>
              {sev.label.toUpperCase()}
            </span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', urgency.color)}>
              · {urgency.label}
            </span>
            {rec.reviewed_at && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">· Revisada</span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-bold text-white sm:text-base">{rec.campaign_name}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/65">{rec.reason}</p>

          {/* Metrics strip */}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Metric label="Spend" value={formatCurrency(rec.metrics.spend)} />
            {rec.metrics.hasRevenue
              ? <Metric label="ROAS" value={`${rec.metrics.roas.toFixed(1)}x`} accent={rec.metrics.roas >= 2} />
              : <Metric label="CTR" value={formatPercent(rec.metrics.ctr)} />}
            {rec.metrics.cpa > 0
              ? <Metric label="CPA" value={formatCurrency(rec.metrics.cpa)} />
              : <Metric label="Conv" value={String(rec.metrics.conversions)} />}
            <Metric label="Freq" value={rec.metrics.frequency.toFixed(1)} />
            <Metric label="Score" value={`${rec.score}/100`} />
          </div>
        </div>

        {/* Right: impact + chevron */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">Impacto</p>
            <p className={cn(
              'mt-0.5 text-sm font-bold tabular-nums',
              rec.impact_type === 'loss_prevention' ? 'text-red-300' : 'text-emerald-300'
            )}>
              {rec.impact_value > 0
                ? (rec.impact_type === 'loss_prevention' ? `-$${rec.impact_value.toFixed(2)}/d` : `+$${rec.impact_value.toFixed(2)}/d`)
                : '—'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-white/40">{conf.label}</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3].map(i => (
                <div key={i} className={cn('h-1 w-1 rounded-full', i <= conf.dots ? conf.color : 'bg-zinc-700')} />
              ))}
            </div>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-white/40 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && <RecommendationDetailPanel rec={rec} />}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] px-5 py-3">
        <button
          type="button"
          onClick={handleMarkReviewed}
          disabled={!!rec.reviewed_at || marking}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] px-3 py-1.5 text-xs font-semibold transition-colors',
            rec.reviewed_at
              ? 'cursor-default bg-emerald-400/10 text-emerald-300'
              : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
          )}
        >
          {marking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : rec.reviewed_at ? (
            <>
              <Check className="h-3.5 w-3.5" /> Revisada
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> Marcar como revisada
            </>
          )}
        </button>
        <Link
          href={`/campaigns?id=${encodeURIComponent(rec.campaign_id)}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.10]"
        >
          Ver campaña <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 tabular-nums">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
      <span className={cn('font-semibold', accent ? 'text-emerald-300' : 'text-white/85')}>{value}</span>
    </span>
  )
}
