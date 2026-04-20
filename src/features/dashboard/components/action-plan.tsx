'use client'

import { cn, formatCurrency } from '@/lib/utils'
import {
  ClipboardList, TrendingUp, Pause, Eye, Palette, Target, Clock,
  Shield, Rocket, Timer, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import type { DailyActionPlan, RecommendationAction, RecommendationConfidence, EffortLevel, ImpactType } from '@/shared/types/database'

const actionIcons: Record<RecommendationAction, typeof TrendingUp> = {
  SCALE: TrendingUp, MONITOR: Eye, PAUSE: Pause,
  REVIEW_CREATIVE: Palette, REVIEW_TARGETING: Target, WAIT: Clock,
}
const actionColors: Record<RecommendationAction, string> = {
  SCALE: 'text-green-400', MONITOR: 'text-blue-400', PAUSE: 'text-red-400',
  REVIEW_CREATIVE: 'text-purple-400', REVIEW_TARGETING: 'text-orange-400', WAIT: 'text-zinc-400',
}

const confDots: Record<RecommendationConfidence, { n: number; color: string; label: string }> = {
  high: { n: 3, color: 'bg-green-400', label: 'Alta' },
  medium: { n: 2, color: 'bg-yellow-400', label: 'Media' },
  low: { n: 1, color: 'bg-zinc-500', label: 'Baja' },
}

const effortLabels: Record<EffortLevel, { label: string; color: string }> = {
  low: { label: '~2 min', color: 'text-green-400' },
  medium: { label: '~10 min', color: 'text-yellow-400' },
  high: { label: '~20 min', color: 'text-orange-400' },
}

const impactTypeLabels: Record<ImpactType, { label: string; icon: typeof Shield; color: string }> = {
  loss_prevention: { label: 'Ahorro', icon: Shield, color: 'text-red-400' },
  opportunity: { label: 'Oportunidad', icon: Rocket, color: 'text-green-400' },
}

interface ActionPlanProps {
  plan: DailyActionPlan
}

export function ActionPlan({ plan }: ActionPlanProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  if (plan.steps.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
            <ClipboardList className="h-3.5 w-3.5 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Plan de Acción</h3>
        </div>
        <p className="mt-3 text-xs text-zinc-400">Sin acciones pendientes. Tus campañas están estables.</p>
      </div>
    )
  }

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/25">
            <ClipboardList className="h-3.5 w-3.5 text-blue-300" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight">Plan de Acción — Hoy</h3>
          <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-zinc-300">{plan.steps.length} pasos</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-zinc-400 tabular-nums">
            <Timer className="h-3 w-3" />
            {plan.execution_time}
          </span>
          {plan.total_savings > 0 && (
            <span className="glass-danger rounded-full px-2.5 py-1 font-semibold text-red-200 tabular-nums">
              Ahorro: {formatCurrency(plan.total_savings)}/día
            </span>
          )}
          {plan.total_opportunity > 0 && (
            <span className="glass-success rounded-full px-2.5 py-1 font-semibold text-green-200 tabular-nums">
              +{formatCurrency(plan.total_opportunity)}/día
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-white/[0.06]">
        {plan.steps.map((s) => {
          const Icon = actionIcons[s.action]
          const color = actionColors[s.action]
          const impactInfo = impactTypeLabels[s.impact_type]
          const ImpactIcon = impactInfo.icon
          const effort = effortLabels[s.effort]
          const conf = confDots[s.confidence]
          const isExp = expandedStep === s.step

          return (
            <div key={s.step} className={cn('transition-all', isExp ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}>
              <button onClick={() => setExpandedStep(isExp ? null : s.step)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left">

                {/* Step number */}
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums border',
                  s.step === 1
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400/40 shadow-glow-blue'
                    : 'bg-white/[0.06] text-zinc-300 border-white/[0.10]')}>
                  {s.step}
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                    <span className={cn('text-xs font-bold', color)}>{s.label}</span>
                    <span className="truncate text-xs text-white">{s.campaign_name}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{s.short_instruction}</p>
                </div>

                {/* Impact + meta */}
                <div className="flex shrink-0 items-center gap-3">
                  {/* Impact badge */}
                  <div className="flex items-center gap-1">
                    <ImpactIcon className={cn('h-3 w-3', impactInfo.color)} />
                    <span className={cn('text-xs font-bold', impactInfo.color)}>
                      {formatCurrency(s.impact_value)}/día
                    </span>
                  </div>
                  {/* Confidence */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map(i => <div key={i} className={cn('h-1 w-1 rounded-full', i <= conf.n ? conf.color : 'bg-zinc-700')} />)}
                  </div>
                  {/* Effort */}
                  <span className={cn('text-[10px] font-medium', effort.color)}>{effort.label}</span>
                  {/* Expand */}
                  <ChevronDown className={cn('h-3 w-3 text-zinc-600 transition-transform', isExp && 'rotate-180')} />
                </div>
              </button>

              {/* Expanded detail */}
              {isExp && (
                <div className="px-5 pb-4 pl-[4.75rem]">
                  <div className="glass-subtle rounded-xl p-4 space-y-2">
                    {/* Why */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Por qué</p>
                      <p className="mt-0.5 text-[11px] text-zinc-300">{s.reason}</p>
                    </div>
                    {/* Projection */}
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Impacto</p>
                        <p className={cn('mt-0.5 text-xs font-medium', impactInfo.color)}>
                          {s.impact_type === 'loss_prevention' ? 'Ahorras' : 'Ganas'} {formatCurrency(s.impact_value)}/día → {formatCurrency(s.impact_monthly)}/mes
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Confianza</p>
                        <p className="mt-0.5 text-xs text-zinc-300">
                          {conf.label} — {s.confidence === 'high' ? 'basado en datos suficientes' : s.confidence === 'medium' ? 'datos parciales' : 'pocos datos'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Score</p>
                        <p className={cn('mt-0.5 text-xs font-bold',
                          s.score >= 70 ? 'text-green-400' : s.score >= 45 ? 'text-yellow-400' : 'text-red-400')}>
                          {s.score}/100
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3.5 bg-white/[0.02]">
        <span className="text-[11px] font-medium text-zinc-400">Impacto total si ejecutas todo</span>
        <span className="text-sm font-bold text-blue-300 tabular-nums">{formatCurrency(plan.total_impact)}/día → {formatCurrency(plan.total_impact * 30)}/mes</span>
      </div>
    </div>
  )
}
