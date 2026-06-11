'use client'

import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import {
  AlertOctagon, Palette, Target, ExternalLink, TrendingDown, Eye,
} from 'lucide-react'
import type { RecommendationAction, SignalSeverity } from '@/shared/types/database'
import type { CampaignChoice } from '../types'

const ACTION_ICON: Record<RecommendationAction, typeof Palette> = {
  PAUSE: AlertOctagon, SCALE: Palette, REVIEW_CREATIVE: Palette, REVIEW_TARGETING: Target,
  FIX_LANDING: ExternalLink, REDUCE_BUDGET: TrendingDown, MONITOR: Eye, WAIT: Eye,
}

const SEVERITY_DOT: Record<SignalSeverity, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-blue-400',
}

interface SelectorProps {
  campaigns: CampaignChoice[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CampaignSelector({ campaigns, selectedId, onSelect }: SelectorProps) {
  if (campaigns.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-white">Campañas que necesitan creativos</h2>
        <span className="text-[10px] text-white/40">· ordenadas por urgencia</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {campaigns.map(c => (
          <Card
            key={c.id}
            c={c}
            selected={selectedId === c.id}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    </section>
  )
}

function Card({ c, selected, onClick }: { c: CampaignChoice; selected: boolean; onClick: () => void }) {
  const Icon = c.recommendation_action ? ACTION_ICON[c.recommendation_action] : Palette
  const dot = c.primary_signal_severity ? SEVERITY_DOT[c.primary_signal_severity] : 'bg-zinc-500'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass-hover rounded-2xl border p-4 text-left transition-all',
        selected
          ? 'glass-info border-blue-400/40 shadow-glow-blue'
          : 'glass border-white/[0.08]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.06]">
          <Icon className="h-4 w-4 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dot)} />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              {c.problem_label}
            </p>
          </div>
          <h3 className="mt-1 truncate text-sm font-bold text-white">{c.name}</h3>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] tabular-nums">
            <Metric label="Score" value={`${c.score}/100`} />
            <Metric label="Spend" value={formatCurrency(c.spend)} />
            {c.roas > 0
              ? <Metric label="ROAS" value={`${c.roas.toFixed(1)}x`} />
              : <Metric label="CTR" value={formatPercent(c.ctr)} />}
            {c.cpa > 0 && <Metric label="CPA" value={formatCurrency(c.cpa)} />}
          </div>
        </div>
      </div>
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
      <span className="font-semibold text-white/85">{value}</span>
    </span>
  )
}
