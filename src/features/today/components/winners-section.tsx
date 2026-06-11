'use client'

import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import type { WinnerCard } from '../types'

export function WinnersSection({ winners }: { winners: WinnerCard[] }) {
  if (winners.length === 0) {
    return (
      <Section title="Funcionando bien" icon={CheckCircle2} color="text-emerald-300">
        <p className="text-xs text-white/40">Aún no hay campañas ganadoras esta semana.</p>
      </Section>
    )
  }

  return (
    <Section title="Funcionando bien" icon={CheckCircle2} color="text-emerald-300" subtitle={`${winners.length} ${winners.length === 1 ? 'campaña' : 'campañas'}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {winners.map(w => <Card key={w.campaign_id} w={w} />)}
      </div>
    </Section>
  )
}

function Section({
  title, subtitle, icon: Icon, color, children,
}: {
  title: string
  subtitle?: string
  icon: typeof CheckCircle2
  color: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className="text-sm font-bold tracking-tight text-white">{title}</h2>
        {subtitle && <span className="text-[10px] text-white/40">· {subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

function Card({ w }: { w: WinnerCard }) {
  return (
    <div className="glass-success glass-hover rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-white" title={w.campaign_name}>{w.campaign_name}</h3>
        <ScorePill score={w.score} />
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/60">{w.reason}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <Metric label="Spend"  value={formatCurrency(w.spend)} />
        {w.revenue > 0 ? (
          <Metric label="Revenue" value={formatCurrency(w.revenue)} accent />
        ) : (
          <Metric label="CTR" value={formatPercent(w.ctr)} />
        )}
        {w.roas > 0 ? (
          <Metric label="ROAS" value={`${w.roas.toFixed(1)}x`} accent icon />
        ) : (
          <Metric label="Score" value={`${w.score}/100`} />
        )}
        {w.cpa > 0 ? (
          <Metric label="CPA" value={formatCurrency(w.cpa)} />
        ) : (
          <Metric label="" value="" />
        )}
      </div>
    </div>
  )
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
    : score >= 45 ? 'text-amber-300 bg-amber-400/10 border-amber-400/20'
    : 'text-red-300 bg-red-400/10 border-red-400/20'
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums', tone)}>
      {score}/100
    </span>
  )
}

function Metric({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: boolean }) {
  if (!label) return <div />
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <span className={cn('text-xs font-bold tabular-nums', accent ? 'text-emerald-300' : 'text-white/85')}>{value}</span>
        {icon && <TrendingUp className="h-2.5 w-2.5 text-emerald-300" />}
      </div>
    </div>
  )
}
