'use client'

import { useEffect, useState } from 'react'
import { cn, formatPercent } from '@/lib/utils'
import {
  Sparkles, TrendingUp, TrendingDown, Loader2, Copy, Image,
  Target, Lightbulb, ArrowRight, RefreshCw, ChevronDown,
} from 'lucide-react'
import type { CreativeInsights, GeneratedCreative, CampaignWithMetrics } from '@/shared/types/database'

export function CreativeLab() {
  const [insights, setInsights] = useState<CreativeInsights | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([])
  const [generated, setGenerated] = useState<GeneratedCreative[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [singleCreative, setSingleCreative] = useState<GeneratedCreative | null>(null)
  const [expandedCreative, setExpandedCreative] = useState<number | null>(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/creative-lab?action=insights').then(r => r.json()),
      fetch('/api/campaigns').then(r => r.json()),
    ]).then(([insData, campData]) => {
      setInsights(insData.insights)
      setCampaigns(campData.campaigns || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function generateForWorst() {
    setGenerating(true)
    setGenerated([])
    setSingleCreative(null)
    const res = await fetch('/api/creative-lab?action=generate-worst').then(r => r.json())
    setGenerated(res.creatives || [])
    setGenerating(false)
    setExpandedCreative(0)
  }

  async function generateForCampaign(id: string) {
    setGenerating(true)
    setSingleCreative(null)
    setGenerated([])
    const res = await fetch(`/api/creative-lab?action=generate&campaignId=${id}`).then(r => r.json())
    if (res.creative && !res.creative.error) setSingleCreative(res.creative)
    setGenerating(false)
  }

  const needsHelp = campaigns
    .filter(c => c.total_spend > 0 && (c.classification === 'loser' || c.avg_ctr < 2))
    .sort((a, b) => a.avg_ctr - b.avg_ctr)

  const allCreatives = singleCreative ? [singleCreative] : generated

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Pattern Analysis */}
      {insights && (
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Patrones Detectados
          </h3>
          <p className="mb-4 text-xs text-zinc-400">{insights.recommendation}</p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Winning patterns */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                <TrendingUp className="h-3 w-3" /> Patrones ganadores
              </h4>
              <div className="space-y-1.5">
                {insights.winning_patterns.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-green-500/10 bg-green-950/10 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-white">{p.pattern}</p>
                      <p className="text-[10px] text-zinc-500">{p.frequency} campañas</p>
                    </div>
                    <span className="text-xs font-bold text-green-400">{p.avg_ctr}% CTR</span>
                  </div>
                ))}
                {insights.winning_patterns.length === 0 && (
                  <p className="text-xs text-zinc-500">Sin patrones suficientes</p>
                )}
              </div>
            </div>

            {/* Losing patterns */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                <TrendingDown className="h-3 w-3" /> Necesitan nuevo creativo
              </h4>
              <div className="space-y-1.5">
                {insights.losing_patterns.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-950/10 px-3 py-2">
                    <p className="truncate text-xs text-white">{p.pattern}</p>
                    <span className="shrink-0 text-xs font-bold text-red-400">{p.avg_ctr}% CTR</span>
                  </div>
                ))}
                {insights.losing_patterns.length === 0 && (
                  <p className="text-xs text-zinc-500">Todas tus campañas están bien</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Controls */}
      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Generar Creativos</h3>
          </div>
          <button onClick={generateForWorst} disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generar para campañas débiles
          </button>
        </div>

        {/* Campaign selector */}
        {needsHelp.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">O selecciona una campaña</p>
            <div className="flex flex-wrap gap-2">
              {needsHelp.slice(0, 6).map(c => (
                <button key={c.id}
                  onClick={() => { setSelectedCampaign(c.id); generateForCampaign(c.id) }}
                  disabled={generating}
                  className={cn('rounded-lg border px-3 py-1.5 text-[11px] transition-colors',
                    selectedCampaign === c.id
                      ? 'border-purple-500/40 bg-purple-600/20 text-purple-300'
                      : 'border-zinc-700 text-zinc-400 hover:border-purple-500/30 hover:text-zinc-200')}>
                  {c.name.slice(0, 30)} ({formatPercent(c.avg_ctr)})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generated Creatives */}
      {generating && (
        <div className="glass rounded-2xl p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-400" />
          <p className="mt-3 text-sm text-zinc-400">Analizando patrones y generando creativos...</p>
          <p className="mt-1 text-xs text-zinc-600">Esto puede tomar 10-20 segundos</p>
        </div>
      )}

      {allCreatives.length > 0 && !generating && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Creativos Generados ({allCreatives.length})</h3>

          {allCreatives.map((creative, idx) => {
            const isExp = expandedCreative === idx
            return (
              <div key={idx} className="glass rounded-2xl overflow-hidden">
                {/* Header */}
                <button onClick={() => setExpandedCreative(isExp ? null : idx)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold',
                      creative.campaign_score >= 70 ? 'bg-green-400/10 text-green-400'
                      : creative.campaign_score >= 45 ? 'bg-yellow-400/10 text-yellow-400'
                      : 'bg-red-400/10 text-red-400')}>
                      {creative.campaign_score}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{creative.campaign_name.slice(0, 50)}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                        <span className="text-red-400">CTR actual: {creative.current_ctr.toFixed(2)}%</span>
                        <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
                        <span className="text-green-400">Objetivo: {creative.target_ctr.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-zinc-600 transition-transform', isExp && 'rotate-180')} />
                </button>

                {/* Expanded Content */}
                {isExp && (
                  <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                    {/* Copy */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* Left: Copy */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-amber-500/15 bg-amber-950/10 p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Hook</p>
                          <p className="mt-1 text-sm font-semibold text-white">{creative.hook}</p>
                        </div>

                        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Headline</p>
                          <p className="mt-1 text-sm font-bold text-white">{creative.headline}</p>
                        </div>

                        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Texto principal</p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-300 whitespace-pre-line">{creative.body}</p>
                        </div>

                        <div className="rounded-lg border border-blue-500/15 bg-blue-950/10 p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">CTA</p>
                          <p className="mt-1 text-sm font-bold text-blue-300">{creative.cta}</p>
                        </div>
                      </div>

                      {/* Right: Image Prompt + Rationale */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-purple-500/15 bg-purple-950/10 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-purple-400">
                              <Image className="mr-1 inline h-3 w-3" />
                              Prompt de imagen
                            </p>
                            <button onClick={() => navigator.clipboard.writeText(creative.image_prompt)}
                              className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-purple-400">
                              <Copy className="h-2.5 w-2.5" /> Copiar
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-zinc-300 font-mono leading-relaxed">{creative.image_prompt}</p>
                        </div>

                        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                            <Target className="mr-1 inline h-3 w-3" />
                            Por qué este creativo
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">{creative.rationale}</p>
                        </div>

                        {creative.based_on.length > 0 && (
                          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Inspirado en</p>
                            <div className="mt-1 space-y-1">
                              {creative.based_on.map((name, i) => (
                                <p key={i} className="text-[11px] text-green-400">{name.slice(0, 50)}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
