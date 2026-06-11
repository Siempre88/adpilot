'use client'

import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { TrendingUp, Pause, Eye, Palette, Target, Clock, ExternalLink, TrendingDown } from 'lucide-react'
import type { CampaignWithMetrics, RecommendationAction } from '@/shared/types/database'

const recIcons: Record<RecommendationAction, typeof TrendingUp> = {
  SCALE: TrendingUp, MONITOR: Eye, PAUSE: Pause,
  REVIEW_CREATIVE: Palette, REVIEW_TARGETING: Target, WAIT: Clock,
  FIX_LANDING: ExternalLink, REDUCE_BUDGET: TrendingDown,
}
const recColors: Record<RecommendationAction, string> = {
  SCALE: 'text-green-400', MONITOR: 'text-blue-400', PAUSE: 'text-red-400',
  REVIEW_CREATIVE: 'text-purple-400', REVIEW_TARGETING: 'text-orange-400', WAIT: 'text-zinc-400',
  FIX_LANDING: 'text-amber-400', REDUCE_BUDGET: 'text-red-300',
}

interface CampaignSummaryProps {
  topCampaigns: CampaignWithMetrics[]
  worstCampaigns: CampaignWithMetrics[]
}

function CompactRow({ campaign, variant }: { campaign: CampaignWithMetrics; variant: 'top' | 'worst' }) {
  const rec = campaign.recommendation
  const Icon = rec ? recIcons[rec.action] : Eye
  const color = rec ? recColors[rec.action] : 'text-zinc-400'

  return (
    <div className="glass-subtle glass-hover flex items-center gap-3 rounded-xl px-3 py-2.5">
      {/* Score */}
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums border',
        campaign.score >= 70 ? 'bg-green-500/15 text-green-300 border-green-500/25' : campaign.score >= 45 ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : 'bg-red-500/15 text-red-300 border-red-500/25')}>
        {campaign.score}
      </div>
      {/* Name + metrics */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{campaign.name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
          <span>CTR {formatPercent(campaign.avg_ctr)}</span>
          <span>{formatCurrency(campaign.total_spend)}</span>
          {campaign.total_conversions > 0 && <span>{campaign.total_conversions} conv</span>}
        </div>
      </div>
      {/* Recommendation */}
      {rec && (
        <div className="flex shrink-0 items-center gap-1">
          <Icon className={cn('h-3 w-3', color)} />
          <span className={cn('text-[10px] font-medium', color)}>{rec.label}</span>
        </div>
      )}
    </div>
  )
}

export function CampaignSummary({ topCampaigns, worstCampaigns }: CampaignSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Top */}
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Mejores Campañas
        </h3>
        <div className="space-y-1.5">
          {topCampaigns.length > 0 ? (
            topCampaigns.slice(0, 3).map(c => <CompactRow key={c.id} campaign={c} variant="top" />)
          ) : (
            <p className="py-2 text-xs text-zinc-600">Sin campañas ganadoras</p>
          )}
        </div>
      </div>
      {/* Worst */}
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Campañas con Problemas
        </h3>
        <div className="space-y-1.5">
          {worstCampaigns.length > 0 ? (
            worstCampaigns.slice(0, 3).map(c => <CompactRow key={c.id} campaign={c} variant="worst" />)
          ) : (
            <p className="py-2 text-xs text-zinc-600">Todas bien</p>
          )}
        </div>
      </div>
    </div>
  )
}
