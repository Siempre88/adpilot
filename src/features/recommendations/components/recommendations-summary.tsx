'use client'

import { cn, formatCurrency } from '@/lib/utils'
import { ListChecks, AlertOctagon, TrendingUp, AlertTriangle } from 'lucide-react'
import type { RecommendationsSummary as Summary } from '../types'

export function RecommendationsSummary({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        icon={ListChecks}
        label="Activas"
        value={summary.total.toString()}
        tone="neutral"
      />
      <Stat
        icon={AlertOctagon}
        label="Críticas"
        value={summary.critical.toString()}
        tone={summary.critical > 0 ? 'danger' : 'neutral'}
      />
      <Stat
        icon={TrendingUp}
        label="Para escalar"
        value={summary.scale_opportunities.toString()}
        tone={summary.scale_opportunities > 0 ? 'success' : 'neutral'}
      />
      <Stat
        icon={AlertTriangle}
        label="Pérdida evitable"
        value={formatCurrency(summary.avoidable_loss)}
        sub={summary.avoidable_loss > 0 ? '/día' : ''}
        tone={summary.avoidable_loss > 0 ? 'danger' : 'success'}
      />
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof ListChecks
  label: string
  value: string
  sub?: string
  tone: 'danger' | 'success' | 'neutral'
}) {
  const valueColor =
    tone === 'danger'  ? 'text-red-300' :
    tone === 'success' ? 'text-emerald-300' :
                          'text-white'
  const iconColor =
    tone === 'danger'  ? 'text-red-300' :
    tone === 'success' ? 'text-emerald-300' :
                          'text-white/40'

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-bold tabular-nums tracking-tight', valueColor)}>{value}</span>
        {sub && <span className="text-[10px] text-white/40">{sub}</span>}
      </div>
    </div>
  )
}
