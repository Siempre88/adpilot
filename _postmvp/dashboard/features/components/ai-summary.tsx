'use client'

import { useEffect, useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { Zap, CheckCircle2, XCircle, ArrowRight, Loader2, ChevronRight } from 'lucide-react'
import type { ExecutiveSummary } from '@/shared/types/database'

const decisionTypeLabels: Record<string, string> = {
  PAUSE: 'PAUSAR', REDUCE_BUDGET: 'REDUCIR', SCALE: 'ESCALAR',
  DUPLICATE: 'DUPLICAR', CHANGE_CREATIVE: 'CAMBIAR CREATIVO', CHANGE_TARGETING: 'CAMBIAR SEGMENTACIÓN',
}
const decisionTypeColors: Record<string, string> = {
  PAUSE: 'bg-red-400/10 text-red-400', REDUCE_BUDGET: 'bg-yellow-400/10 text-yellow-400',
  SCALE: 'bg-green-400/10 text-green-400', DUPLICATE: 'bg-blue-400/10 text-blue-400',
  CHANGE_CREATIVE: 'bg-purple-400/10 text-purple-400', CHANGE_TARGETING: 'bg-orange-400/10 text-orange-400',
}

export function AiSummary() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllWorking, setShowAllWorking] = useState(false)

  useEffect(() => {
    fetch('/api/insights?type=executive')
      .then(r => r.json())
      .then(data => { setSummary(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <p className="text-sm text-zinc-400">Generando resumen...</p>
        </div>
      </div>
    )
  }

  if (!summary) return null

  const visibleWorking = showAllWorking ? summary.working : summary.working.slice(0, 3)
  const visibleFailing = summary.failing.slice(0, 2)
  const hasMoreWorking = summary.working.length > 3

  return (
    <div className="glass-info rounded-2xl p-5">
      {/* Header — compact */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.15]">
            <Zap className="h-4 w-4 text-blue-300" strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight">Resumen — {summary.date}</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          <span className="text-zinc-400">Gasto <span className="font-semibold text-white">{formatCurrency(summary.total_spend)}</span></span>
          {summary.total_revenue > 0 && (
            <span className="text-zinc-400">Rev <span className="font-semibold text-green-300">{formatCurrency(summary.total_revenue)}</span></span>
          )}
          {summary.overall_roas > 0 && (
            <span className="text-zinc-400">ROAS <span className="font-semibold text-blue-300">{summary.overall_roas}x</span></span>
          )}
        </div>
      </div>

      {/* 3-column layout: Actions gets more weight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Actions — 5 cols, visually dominant */}
        <div className="lg:col-span-5">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-400">
            <ArrowRight className="h-3 w-3" />
            Hacer Hoy
          </h4>
          {summary.actions.length > 0 ? (
            <div className="space-y-2">
              {summary.actions.map((item, i) => (
                <div key={i} className="rounded-lg border border-blue-500/10 bg-blue-950/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', decisionTypeColors[item.type] || 'bg-zinc-800 text-zinc-400')}>
                      {decisionTypeLabels[item.type] || item.type}
                    </span>
                    <p className="truncate text-xs font-medium text-white">{item.campaign_name}</p>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{item.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">Sin acciones pendientes</p>
          )}
          {/* Loss / Opportunity bar */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-1.5 text-[10px]">
            {summary.avoidable_loss > 0 ? (
              <span className="text-red-400">Pérdida evitable: {formatCurrency(summary.avoidable_loss)}/día</span>
            ) : (
              <span className="text-green-400">Sin pérdidas detectadas</span>
            )}
            {summary.revenue_opportunity > 0 && (
              <span className="text-green-400">+{formatCurrency(summary.revenue_opportunity)} potencial</span>
            )}
          </div>
        </div>

        {/* Working — 4 cols */}
        <div className="lg:col-span-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Funciona
          </h4>
          <div className="space-y-1.5">
            {visibleWorking.map((item, i) => (
              <div key={i} className="rounded-lg border border-zinc-800/50 bg-zinc-900/40 px-3 py-2">
                <p className="truncate text-[11px] font-medium text-white">{item.campaign_name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{item.detail}</p>
              </div>
            ))}
          </div>
          {hasMoreWorking && (
            <button onClick={() => setShowAllWorking(!showAllWorking)}
              className="mt-1.5 flex items-center gap-0.5 text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors">
              {showAllWorking ? 'Ver menos' : `+${summary.working.length - 3} más`}
              <ChevronRight className={cn('h-3 w-3 transition-transform', showAllWorking && 'rotate-90')} />
            </button>
          )}
        </div>

        {/* Failing — 3 cols */}
        <div className="lg:col-span-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
            <XCircle className="h-3 w-3" />
            Falla
          </h4>
          {visibleFailing.length > 0 ? (
            <div className="space-y-1.5">
              {visibleFailing.map((item, i) => (
                <div key={i} className="rounded-lg border border-red-500/10 bg-red-950/10 px-3 py-2">
                  <p className="truncate text-[11px] font-medium text-white">{item.campaign_name}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{item.detail}</p>
                </div>
              ))}
              {summary.failing.length > 2 && (
                <p className="text-[10px] text-zinc-600">+{summary.failing.length - 2} más</p>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500">Todo bien</p>
          )}
        </div>
      </div>
    </div>
  )
}
