'use client'

import { useEffect, useState } from 'react'
import { KpiCards } from '@/features/dashboard/components/kpi-cards'
import { CampaignSummary } from '@/features/dashboard/components/campaign-summary'
import { AiSummary } from '@/features/dashboard/components/ai-summary'
import { ActionPlan } from '@/features/dashboard/components/action-plan'
import { DecisionCenter } from '@/features/dashboard/components/decision-center'
import { ValueHero } from '@/features/dashboard/components/value-hero'
import { UpgradeGate } from '@/shared/components/upgrade-gate'
import { SyncStatus } from '@/shared/components/sync-status'
import { usePlan } from '@/shared/lib/plan-context'
import { Loader2, AlertTriangle, KeyRound, RefreshCw } from 'lucide-react'
import type { DashboardSummary, ExecutiveSummary, CampaignWithMetrics } from '@/shared/types/database'

type MetaStatus = 'connected' | 'expired' | 'invalid' | 'missing' | null

export default function DashboardPage() {
  const { isPro, limits } = usePlan()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metaStatus, setMetaStatus] = useState<MetaStatus>(null)

  function fetchData() {
    Promise.all([
      fetch('/api/insights').then(r => r.json()),
      fetch('/api/insights?type=executive').then(r => r.json()),
      fetch('/api/campaigns').then(r => r.json()),
    ])
      .then(([dashData, execData, campData]) => {
        if (dashData.error_type === 'meta_auth') {
          setMetaStatus(dashData.error_status)
          setError(dashData.error)
          setLoading(false)
          return
        }
        if (dashData.error) {
          setError(dashData.error)
          setLoading(false)
          return
        }
        setMetaStatus('connected')
        setSummary(dashData)
        setExecutive(execData)
        setCampaigns(campData.campaigns || [])
        setLoading(false)
      })
      .catch((err) => { setError(err.message); setLoading(false) })
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <p className="text-sm text-zinc-400">Cargando datos de Meta Ads...</p>
      </div>
    )
  }

  // Token expired / invalid — friendly UI
  if (metaStatus === 'expired' || metaStatus === 'invalid' || metaStatus === 'missing') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-amber-500/10 p-4">
          <KeyRound className="h-8 w-8 text-amber-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">
            {metaStatus === 'expired' ? 'Tu conexión con Meta expiró' : metaStatus === 'missing' ? 'Token de Meta no configurado' : 'Token de Meta inválido'}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            {metaStatus === 'expired'
              ? 'El token de acceso a Meta Ads expiró o la sesión se cerró. Necesitas generar uno nuevo.'
              : metaStatus === 'missing'
              ? 'No se encontró META_ACCESS_TOKEN en las variables de entorno.'
              : 'El token proporcionado no es válido. Genera uno nuevo.'}
          </p>
        </div>

        <div className="glass mt-2 w-full max-w-lg rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white">Cómo actualizar el token:</h3>
          <ol className="mt-3 space-y-2 text-xs text-zinc-400">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</span>
              Ve a <span className="font-medium text-blue-400">developers.facebook.com/tools/explorer</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">2</span>
              Selecciona tu app y genera un nuevo token con permisos <code className="rounded bg-zinc-800 px-1 text-[10px]">ads_read</code>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span>
              Copia el token y reemplázalo en <code className="rounded bg-zinc-800 px-1 text-[10px]">.env.local</code> → <code className="rounded bg-zinc-800 px-1 text-[10px]">META_ACCESS_TOKEN</code>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">4</span>
              Reinicia el servidor: <code className="rounded bg-zinc-800 px-1 text-[10px]">npm run dev</code>
            </li>
          </ol>
        </div>

        <button onClick={() => window.location.reload()}
          className="mt-2 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
          <RefreshCw className="h-3.5 w-3.5" />
          Ya actualicé el token, recargar
        </button>

        {error && <p className="mt-2 text-[10px] text-zinc-600">{error}</p>}
      </div>
    )
  }

  // Generic error
  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-400">Error al conectar con Meta Ads</p>
        <p className="text-xs text-zinc-500">{error}</p>
      </div>
    )
  }

  if (!summary) return null

  const actionPlan = executive?.action_plan
  const visibleCampaigns = isPro ? campaigns : campaigns.slice(0, limits.max_campaigns_visible)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Centro de control de Meta Ads</p>
        </div>
        <SyncStatus onSyncComplete={() => fetchData()} />
      </div>

      {actionPlan && <ValueHero plan={actionPlan} dailyLoss={summary.daily_loss} />}
      <AiSummary />
      <KpiCards summary={summary} />

      {actionPlan && (
        isPro ? (
          <ActionPlan plan={actionPlan} />
        ) : (
          <UpgradeGate feature="Plan de Acción Completo" impactValue={actionPlan.total_impact}
            teaser={<ActionPlan plan={{ ...actionPlan, steps: actionPlan.steps.slice(0, 1) }} />}>
            <ActionPlan plan={actionPlan} />
          </UpgradeGate>
        )
      )}

      {isPro ? (
        <DecisionCenter campaigns={visibleCampaigns} />
      ) : (
        <UpgradeGate feature="Centro de Decisiones" impactValue={actionPlan?.total_impact}>
          <DecisionCenter campaigns={visibleCampaigns} />
        </UpgradeGate>
      )}

      <CampaignSummary topCampaigns={summary.top_campaigns} worstCampaigns={summary.worst_campaigns} />
    </div>
  )
}
