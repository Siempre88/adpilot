'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Pause,
  TrendingDown,
  TrendingUp,
  Copy,
  Palette,
  Target,
  Loader2,
} from 'lucide-react'
import type { Alert, DecisionType, AlertSeverity } from '@/shared/types/database'

const severityConfig: Record<AlertSeverity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  critical: { label: 'Crítica', color: 'text-red-400', bgColor: 'bg-red-400/10', borderColor: 'border-red-500/30' },
  high: { label: 'Alta', color: 'text-orange-400', bgColor: 'bg-orange-400/10', borderColor: 'border-orange-500/30' },
  medium: { label: 'Media', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', borderColor: 'border-yellow-500/30' },
  low: { label: 'Baja', color: 'text-blue-400', bgColor: 'bg-blue-400/10', borderColor: 'border-blue-500/30' },
}

const decisionIcons: Record<DecisionType, typeof Pause> = {
  PAUSE: Pause,
  REDUCE_BUDGET: TrendingDown,
  SCALE: TrendingUp,
  DUPLICATE: Copy,
  CHANGE_CREATIVE: Palette,
  CHANGE_TARGETING: Target,
}

const decisionLabels: Record<DecisionType, string> = {
  PAUSE: 'Pausar',
  REDUCE_BUDGET: 'Reducir Presupuesto',
  SCALE: 'Escalar',
  DUPLICATE: 'Duplicar',
  CHANGE_CREATIVE: 'Cambiar Creativo',
  CHANGE_TARGETING: 'Cambiar Segmentación',
}

export function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all')

  useEffect(() => {
    fetch('/api/alerts')
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data.alerts)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    )
  }

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter)

  const severityCounts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {(Object.keys(severityConfig) as AlertSeverity[]).map((sev) => {
          const config = severityConfig[sev]
          return (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? 'all' : sev)}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                filter === sev ? `${config.borderColor} ${config.bgColor}` : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.06]'
              )}
            >
              <p className={cn('text-2xl font-bold', config.color)}>{severityCounts[sev]}</p>
              <p className="mt-1 text-xs text-zinc-400">{config.label}</p>
            </button>
          )
        })}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const sevConfig = severityConfig[alert.severity]
          const Icon = decisionIcons[alert.type] || AlertTriangle

          return (
            <div
              key={alert.id}
              className={cn(
                'rounded-xl border p-5 transition-colors',
                sevConfig.borderColor,
                'bg-zinc-900/50'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 rounded-lg p-2', sevConfig.bgColor)}>
                    <Icon className={cn('h-4 w-4', sevConfig.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{alert.campaign_name}</h3>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', sevConfig.bgColor, sevConfig.color)}>
                        {sevConfig.label}
                      </span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        {decisionLabels[alert.type]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: 4-field format */}
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Problema</p>
                  <p className="text-xs text-zinc-300">{alert.problem}</p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Impacto</p>
                  <p className="text-xs text-zinc-300">{alert.impact}</p>
                </div>
                <div className={cn('rounded-lg p-3', sevConfig.bgColor)}>
                  <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wider', sevConfig.color)}>Acción Sugerida</p>
                  <p className="text-xs text-zinc-200">{alert.action}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-500">No hay alertas con este filtro</p>
        </div>
      )}
    </div>
  )
}
