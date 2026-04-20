'use client'

import { useEffect, useState } from 'react'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import {
  ArrowUpDown, Loader2, TrendingUp, Pause, Eye, Palette, Target, Clock,
  Filter, ChevronDown,
} from 'lucide-react'
import type { CampaignWithMetrics, RecommendationAction, RecommendationConfidence } from '@/shared/types/database'

const classificationStyles = {
  winner: { label: 'Ganadora', className: 'bg-green-400/10 text-green-400' },
  at_risk: { label: 'En Riesgo', className: 'bg-yellow-400/10 text-yellow-400' },
  loser: { label: 'Perdedora', className: 'bg-red-400/10 text-red-400' },
  new: { label: 'Nueva', className: 'bg-zinc-400/10 text-zinc-400' },
}

const recIcons: Record<RecommendationAction, typeof TrendingUp> = {
  SCALE: TrendingUp, MONITOR: Eye, PAUSE: Pause,
  REVIEW_CREATIVE: Palette, REVIEW_TARGETING: Target, WAIT: Clock,
}

const recColors: Record<RecommendationAction, string> = {
  SCALE: 'text-green-400', MONITOR: 'text-blue-400', PAUSE: 'text-red-400',
  REVIEW_CREATIVE: 'text-purple-400', REVIEW_TARGETING: 'text-orange-400', WAIT: 'text-zinc-400',
}

const confidenceDots: Record<RecommendationConfidence, { dots: number; color: string; label: string }> = {
  high: { dots: 3, color: 'bg-green-400', label: 'Alta' },
  medium: { dots: 2, color: 'bg-yellow-400', label: 'Media' },
  low: { dots: 1, color: 'bg-zinc-500', label: 'Baja' },
}

type SortKey = 'name' | 'total_spend' | 'avg_ctr' | 'avg_cpc' | 'total_conversions' | 'score'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-400 border-green-500/30 bg-green-400/5'
    : score >= 45 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-400/5'
    : score >= 20 ? 'text-orange-400 border-orange-500/30 bg-orange-400/5'
    : 'text-red-400 border-red-500/30 bg-red-400/5'
  return <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold', color)}>{score}</div>
}

function ConfidenceIndicator({ confidence }: { confidence: RecommendationConfidence }) {
  const c = confidenceDots[confidence]
  return (
    <div className="flex items-center gap-1" title={`Confianza: ${c.label}`}>
      {[1, 2, 3].map(d => <div key={d} className={cn('h-1.5 w-1.5 rounded-full', d <= c.dots ? c.color : 'bg-zinc-700')} />)}
    </div>
  )
}

// ─── Filter options ───
const recFilterOptions: { value: RecommendationAction | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'SCALE', label: 'Escalar' },
  { value: 'MONITOR', label: 'Vigilar' },
  { value: 'PAUSE', label: 'Pausar' },
  { value: 'REVIEW_CREATIVE', label: 'Creativo' },
  { value: 'REVIEW_TARGETING', label: 'Segmentación' },
  { value: 'WAIT', label: 'Esperar' },
]

const scoreFilterOptions = [
  { value: 'ALL', label: 'Todo' },
  { value: '70', label: '70+' },
  { value: '45', label: '45+' },
  { value: 'LOW', label: '<45' },
]

const confFilterOptions: { value: RecommendationConfidence | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toda' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

export function CampaignsTable({ maxCampaigns }: { maxCampaigns?: number } = {}) {
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortAsc, setSortAsc] = useState(false)
  const [days, setDays] = useState<number | string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [recFilter, setRecFilter] = useState<RecommendationAction | 'ALL'>('ALL')
  const [scoreFilter, setScoreFilter] = useState('ALL')
  const [confFilter, setConfFilter] = useState<RecommendationConfidence | 'ALL'>('ALL')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/campaigns?days=${days}`)
      .then(r => r.json())
      .then(data => { setCampaigns(data.campaigns || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  // Apply plan limit
  const planLimited = maxCampaigns ? campaigns.slice(0, maxCampaigns) : campaigns

  // Apply filters
  let filtered = planLimited
  if (recFilter !== 'ALL') filtered = filtered.filter(c => c.recommendation?.action === recFilter)
  if (scoreFilter === '70') filtered = filtered.filter(c => c.score >= 70)
  else if (scoreFilter === '45') filtered = filtered.filter(c => c.score >= 45)
  else if (scoreFilter === 'LOW') filtered = filtered.filter(c => c.score < 45)
  if (confFilter !== 'ALL') filtered = filtered.filter(c => c.recommendation?.confidence === confFilter)

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey]; const bVal = b[sortKey]
    if (typeof aVal === 'string') return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
  })

  const activeFilters = [recFilter !== 'ALL', scoreFilter !== 'ALL', confFilter !== 'ALL'].filter(Boolean).length

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    return (
      <button onClick={() => handleSort(sortKeyName)}
        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-white transition-colors">
        {label}
        <ArrowUpDown className={cn('h-3 w-3', sortKey === sortKeyName ? 'text-blue-400' : 'text-zinc-600')} />
      </button>
    )
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>

  return (
    <div>
      {/* Controls row */}
      <div className="mb-4 flex items-center justify-between">
        {/* Time filter */}
        <div className="flex items-center gap-2">
          {[{ value: 1, label: '1d' }, { value: 3, label: '3d' }, { value: 7, label: '7d' },
            { value: 14, label: '14d' }, { value: 30, label: '30d' }, { value: 'all', label: 'Todo' },
          ].map(d => (
            <button key={String(d.value)} onClick={() => setDays(d.value)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                days === d.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            showFilters || activeFilters > 0 ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
          <Filter className="h-3.5 w-3.5" />
          Filtros{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 glass rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Recommendation filter */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Decisión</p>
              <div className="flex flex-wrap gap-1.5">
                {recFilterOptions.map(o => (
                  <button key={o.value} onClick={() => setRecFilter(o.value)}
                    className={cn('rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                      recFilter === o.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Score filter */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Score</p>
              <div className="flex flex-wrap gap-1.5">
                {scoreFilterOptions.map(o => (
                  <button key={o.value} onClick={() => setScoreFilter(o.value)}
                    className={cn('rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                      scoreFilter === o.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Confidence filter */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Confianza</p>
              <div className="flex flex-wrap gap-1.5">
                {confFilterOptions.map(o => (
                  <button key={o.value} onClick={() => setConfFilter(o.value)}
                    className={cn('rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                      confFilter === o.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="mb-2 text-xs text-zinc-500">{sorted.length} de {campaigns.length} campañas</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-3 py-3 text-center"><SortHeader label="Score" sortKeyName="score" /></th>
              <th className="px-4 py-3 text-left"><SortHeader label="Campaña" sortKeyName="name" /></th>
              <th className="px-4 py-3 text-left"><span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Decisión</span></th>
              <th className="px-3 py-3 text-center"><span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Conf.</span></th>
              <th className="px-4 py-3 text-right"><SortHeader label="Gasto" sortKeyName="total_spend" /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="CTR" sortKeyName="avg_ctr" /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="CPC" sortKeyName="avg_cpc" /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="Conv." sortKeyName="total_conversions" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const style = classificationStyles[c.classification]
              const rec = c.recommendation
              const RecIcon = rec ? recIcons[rec.action] : Eye
              const recColor = rec ? recColors[rec.action] : 'text-zinc-400'
              const isExp = expanded === c.id

              return (
                <tr key={c.id} onClick={() => setExpanded(isExp ? null : c.id)}
                  className={cn('border-b border-zinc-800/50 cursor-pointer transition-colors',
                    isExp ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20')}>
                  <td className="px-3 py-3 text-center"><div className="flex justify-center"><ScoreBadge score={c.score} /></div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate text-sm font-medium text-white">{c.name}</span>
                      <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium', style.className)}>{style.label}</span>
                    </div>
                    {isExp && rec && (
                      <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-900/80 p-3 space-y-2.5">
                        {/* 1. Recommendation + Confidence */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RecIcon className={cn('h-4 w-4', recColor)} />
                            <span className={cn('text-xs font-bold', recColor)}>{rec.label}</span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-medium', style.className)}>{style.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ConfidenceIndicator confidence={rec.confidence} />
                            <span className="text-[10px] text-zinc-500">confianza {confidenceDots[rec.confidence].label.toLowerCase()}</span>
                          </div>
                        </div>
                        {/* 2. Explanation */}
                        {rec.explanation && (
                          <>
                            <div>
                              <p className={cn('text-[11px] font-semibold', recColor)}>{rec.explanation.headline}</p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{rec.explanation.reason}</p>
                            </div>
                            {/* 3. Trigger metrics */}
                            <div className="flex flex-wrap gap-1.5">
                              {rec.explanation.trigger_metrics.map((m, i) => (
                                <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500">{m}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rec && (
                      <div className="flex items-center gap-1.5">
                        <RecIcon className={cn('h-3.5 w-3.5', recColor)} />
                        <span className={cn('text-xs font-medium', recColor)}>{rec.label}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {rec && <div className="flex justify-center"><ConfidenceIndicator confidence={rec.confidence} /></div>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-white">{formatCurrency(c.total_spend)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-sm', c.avg_ctr >= 1.5 ? 'text-green-400' : c.avg_ctr >= 0.8 ? 'text-yellow-400' : 'text-red-400')}>
                      {formatPercent(c.avg_ctr)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-sm', c.avg_cpc <= 1.5 ? 'text-green-400' : c.avg_cpc <= 3 ? 'text-yellow-400' : 'text-red-400')}>
                      {formatCurrency(c.avg_cpc)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-white">{c.total_conversions}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
