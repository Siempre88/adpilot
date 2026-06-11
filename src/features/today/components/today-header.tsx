'use client'

import { cn, formatCurrency } from '@/lib/utils'
import { TrendingUp, AlertTriangle, ShieldCheck, Moon, Calendar } from 'lucide-react'
import type { TodayHeader as Header } from '../types'

const STATUS_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-300',     glow: 'shadow-glow-red',    bg: 'glass-danger'  },
  at_risk:  { icon: AlertTriangle, color: 'text-amber-300',   glow: '',                   bg: 'glass-warning' },
  healthy:  { icon: ShieldCheck,   color: 'text-emerald-300', glow: 'shadow-glow-green',  bg: 'glass-success' },
  idle:     { icon: Moon,          color: 'text-zinc-400',    glow: '',                   bg: 'glass'         },
} as const

function todayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return iso
  }
}

export function TodayHeader({ header }: { header: Header }) {
  const status = STATUS_CONFIG[header.account_status]
  const StatusIcon = status.icon

  return (
    <div className="glass-hero relative overflow-hidden rounded-2xl p-6">
      {/* Atmospheric tint */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />

      <div className="relative">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-white/50">
              <Calendar className="h-3 w-3" />
              <span>{todayLabel(header.date)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Hoy en tus campañas
            </h1>
          </div>

          <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', status.bg, status.glow)}>
            <StatusIcon className={cn('h-3.5 w-3.5', status.color)} />
            <span className={status.color}>{header.account_status_label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Acciones recomendadas"
            value={header.total_actions.toString()}
            sub={
              header.total_actions > header.visible_actions
                ? `Mostrando top ${header.visible_actions}`
                : 'Todas visibles'
            }
            tone={header.total_actions === 0 ? 'neutral' : 'accent'}
          />
          <Stat
            label="Pérdida evitable"
            value={formatCurrency(header.avoidable_loss)}
            sub={header.avoidable_loss > 0 ? '/ día' : 'Cero pérdida hoy'}
            tone={header.avoidable_loss > 0 ? 'danger' : 'success'}
          />
          <Stat
            label="Oportunidad"
            value={`+${formatCurrency(header.revenue_opportunity)}`}
            sub={header.revenue_opportunity > 0 ? 'potencial / día' : 'sin oportunidad clara'}
            tone={header.revenue_opportunity > 0 ? 'success' : 'neutral'}
            icon={TrendingUp}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  tone: 'accent' | 'success' | 'danger' | 'neutral'
  icon?: typeof TrendingUp
}) {
  const valueColor =
    tone === 'success' ? 'text-emerald-300' :
    tone === 'danger'  ? 'text-red-300'     :
    tone === 'accent'  ? 'text-white'       :
                         'text-zinc-300'

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-bold tabular-nums tracking-tight', valueColor)}>{value}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-emerald-300" />}
      </div>
      {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
    </div>
  )
}
