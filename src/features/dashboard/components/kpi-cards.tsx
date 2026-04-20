'use client'

import { formatCurrency, formatPercent, formatRoas } from '@/lib/utils'
import {
  DollarSign,
  TrendingUp,
  MousePointerClick,
  Megaphone,
  AlertTriangle,
  Trophy,
} from 'lucide-react'
import type { DashboardSummary } from '@/shared/types/database'

interface KpiCardsProps {
  summary: DashboardSummary
}

export function KpiCards({ summary }: KpiCardsProps) {
  const cards = [
    {
      title: 'Gasto Total',
      value: formatCurrency(summary.total_spend),
      icon: DollarSign,
      iconColor: 'text-red-300',
      iconBg: 'bg-red-500/15 border-red-500/25',
    },
    {
      title: 'Revenue',
      value: formatCurrency(summary.total_revenue),
      icon: TrendingUp,
      iconColor: 'text-green-300',
      iconBg: 'bg-green-500/15 border-green-500/25',
    },
    {
      title: 'ROAS',
      value: formatRoas(summary.overall_roas),
      icon: Trophy,
      iconColor: summary.overall_roas >= 2.5 ? 'text-green-300' : summary.overall_roas > 0 ? 'text-amber-300' : 'text-zinc-500',
      iconBg: summary.overall_roas >= 2.5 ? 'bg-green-500/15 border-green-500/25' : summary.overall_roas > 0 ? 'bg-amber-500/15 border-amber-500/25' : 'bg-white/[0.04] border-white/[0.08]',
    },
    {
      title: 'CTR Promedio',
      value: formatPercent(summary.avg_ctr),
      icon: MousePointerClick,
      iconColor: summary.avg_ctr >= 1.5 ? 'text-green-300' : 'text-amber-300',
      iconBg: summary.avg_ctr >= 1.5 ? 'bg-green-500/15 border-green-500/25' : 'bg-amber-500/15 border-amber-500/25',
    },
    {
      title: 'Campañas',
      value: summary.active_campaigns.toString(),
      subtitle: `${summary.winning_campaigns}W · ${summary.losing_campaigns}L · ${summary.at_risk_campaigns}R`,
      icon: Megaphone,
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-500/15 border-blue-500/25',
    },
    {
      title: 'Pérdida / día',
      value: summary.daily_loss > 0 ? formatCurrency(summary.daily_loss) : '$0',
      icon: AlertTriangle,
      iconColor: summary.daily_loss > 0 ? 'text-red-300' : 'text-green-300',
      iconBg: summary.daily_loss > 0 ? 'bg-red-500/15 border-red-500/25' : 'bg-green-500/15 border-green-500/25',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.title} className="glass glass-hover rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{card.title}</p>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${card.iconBg}`}>
              <card.icon className={`h-3.5 w-3.5 ${card.iconColor}`} strokeWidth={2.5} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-white tabular-nums tracking-tight">{card.value}</p>
          {card.subtitle && <p className="mt-0.5 text-[10px] font-medium text-zinc-500 tabular-nums">{card.subtitle}</p>}
        </div>
      ))}
    </div>
  )
}
