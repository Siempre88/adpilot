'use client'

import { formatCurrency } from '@/lib/utils'
import { Shield, Rocket, Zap, AlertTriangle } from 'lucide-react'
import type { DailyActionPlan } from '@/shared/types/database'

interface ValueHeroProps {
  plan: DailyActionPlan
  dailyLoss: number
}

export function ValueHero({ plan, dailyLoss }: ValueHeroProps) {
  const hasActions = plan.steps.length > 0
  const totalMonthly = plan.total_impact * 30

  return (
    <div className="glass-hero relative overflow-hidden rounded-3xl">
      {/* Atmospheric glows behind glass */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/10 blur-3xl" />

      <div className="relative px-7 py-6">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.15] backdrop-blur-xl">
                <Zap className="h-4 w-4 text-blue-300" strokeWidth={2.5} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/80">Impacto de Hoy</h2>
            </div>
            {hasActions ? (
              <div className="mt-3">
                <p className="text-5xl font-black text-white tabular-nums tracking-tight">
                  {formatCurrency(plan.total_impact)}
                  <span className="ml-2 text-xl font-medium text-white/50">/día</span>
                </p>
                <p className="mt-1.5 text-sm text-white/60">
                  <span className="text-white/90 font-semibold tabular-nums">{formatCurrency(totalMonthly)}/mes</span> si ejecutas las {plan.steps.length} acciones
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/60">Sin acciones pendientes. Tus campañas están estables.</p>
            )}
          </div>

          {hasActions && (
            <div className="glass-subtle rounded-2xl px-5 py-3.5 text-center">
              <p className="text-3xl font-bold text-blue-300 tabular-nums">{plan.steps.length}</p>
              <p className="text-[10px] font-medium text-white/60">acciones</p>
              <p className="text-[10px] text-white/40 tabular-nums">{plan.execution_time}</p>
            </div>
          )}
        </div>

        {/* Breakdown */}
        {hasActions && (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {plan.total_savings > 0 && (
              <div className="glass-danger rounded-2xl px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-red-300" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">Ahorro</p>
                </div>
                <p className="mt-1.5 text-xl font-bold text-red-200 tabular-nums">{formatCurrency(plan.total_savings)}/día</p>
                <p className="text-[10px] text-red-200/60 tabular-nums">{formatCurrency(plan.total_savings * 30)}/mes</p>
              </div>
            )}

            {plan.total_opportunity > 0 && (
              <div className="glass-success rounded-2xl px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5 text-green-300" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Oportunidad</p>
                </div>
                <p className="mt-1.5 text-xl font-bold text-green-200 tabular-nums">+{formatCurrency(plan.total_opportunity)}/día</p>
                <p className="text-[10px] text-green-200/60 tabular-nums">+{formatCurrency(plan.total_opportunity * 30)}/mes</p>
              </div>
            )}

            {dailyLoss > 0 && (
              <div className="glass-warning rounded-2xl px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Si no actúas</p>
                </div>
                <p className="mt-1.5 text-xl font-bold text-amber-200 tabular-nums">-{formatCurrency(dailyLoss)}/día</p>
                <p className="text-[10px] text-amber-200/60 tabular-nums">-{formatCurrency(dailyLoss * 30)}/mes</p>
              </div>
            )}

            <div className="glass-subtle rounded-2xl px-4 py-3.5">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(i => <div key={i} className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.7)]" />)}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Confianza</p>
              </div>
              <p className="mt-1.5 text-xl font-bold text-white tabular-nums">
                {plan.steps.filter(s => s.confidence === 'high').length}/{plan.steps.length}
              </p>
              <p className="text-[10px] text-white/50">con datos sólidos</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
