'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, ScanSearch } from 'lucide-react'
import { CampaignSelector } from '@/features/creative-lab/components/campaign-selector'
import { CreativeDiagnosis } from '@/features/creative-lab/components/creative-diagnosis'
import { CreativeGenerator } from '@/features/creative-lab/components/creative-generator'
import { CreativeOutput } from '@/features/creative-lab/components/creative-output'
import { CriticPanel } from '@/features/creative-lab/components/critic-panel'
import { EmptyState } from '@/features/creative-lab/components/empty-state'
import type {
  CreativeAngle,
  CreativeLabResponse,
  GeneratedCreatives,
} from '@/features/creative-lab/types'

export default function CreativeLabPage() {
  const [bootstrap, setBootstrap] = useState<CreativeLabResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [angle, setAngle] = useState<CreativeAngle>('auto')
  const [generated, setGenerated] = useState<GeneratedCreatives | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [criticOpen, setCriticOpen] = useState(false)
  const [criticInitial, setCriticInitial] = useState<{ text: string; type: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' }>({ text: '', type: 'ad' as 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' })

  const selectedCampaign = useMemo(() => {
    if (!bootstrap || bootstrap.state !== 'loaded') return null
    return bootstrap.campaigns.find(c => c.id === selectedId) ?? null
  }, [bootstrap, selectedId])

  // Load bootstrap on mount
  useEffect(() => {
    setLoading(true)
    fetch('/api/creative/generate', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => setBootstrap(json as CreativeLabResponse))
      .catch(() => setBootstrapError('No se pudo cargar Creative Lab'))
      .finally(() => setLoading(false))
  }, [])

  // Auto-pick first campaign on load
  useEffect(() => {
    if (bootstrap?.state === 'loaded' && bootstrap.campaigns.length > 0 && !selectedId) {
      setSelectedId(bootstrap.campaigns[0].id)
    }
  }, [bootstrap, selectedId])

  // Reset generated when campaign changes
  useEffect(() => { setGenerated(null); setGenError(null) }, [selectedId])

  async function handleGenerate() {
    if (!selectedId || generating) return
    setGenerating(true); setGenError(null); setGenerated(null)
    try {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedId, angle }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setGenError(json.error || 'No se pudieron generar creativos')
      } else {
        setGenerated(json as GeneratedCreatives)
      }
    } catch {
      setGenError('Error de red al generar')
    } finally {
      setGenerating(false)
    }
  }

  function openCritic(text: string, type: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script') {
    setCriticInitial({ text, type })
    setCriticOpen(true)
  }

  function openCriticBlank() {
    setCriticInitial({ text: '', type: 'ad' as 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' })
    setCriticOpen(true)
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
      </div>
    )
  }

  if (bootstrapError) {
    return (
      <div className="glass-danger rounded-2xl p-6 text-center">
        <p className="text-sm text-red-200">{bootstrapError}</p>
      </div>
    )
  }

  if (!bootstrap) return null

  if (bootstrap.state === 'empty') {
    return <EmptyState data={bootstrap} />
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-hero relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="logo-glow flex h-11 w-11 items-center justify-center rounded-2xl">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Creative Lab</h1>
              <p className="mt-1 text-sm text-white/60">
                Creatividad basada en los problemas reales de tus campañas.
              </p>
            </div>
          </div>
          <button
            onClick={openCriticBlank}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ScanSearch className="h-3.5 w-3.5" /> Critic Mode
          </button>
        </div>
      </div>

      <CampaignSelector
        campaigns={bootstrap.campaigns}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selectedCampaign && generated?.diagnosis && (
        <CreativeDiagnosis diagnosis={generated.diagnosis} />
      )}

      {selectedCampaign && !generated && (
        <DiagnosisOnly campaignId={selectedCampaign.id} />
      )}

      {selectedCampaign && (
        <CreativeGenerator
          angle={angle}
          onAngleChange={setAngle}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      {genError && (
        <div className="glass-danger rounded-2xl p-4 text-sm text-red-200">{genError}</div>
      )}

      {generated && (
        <CreativeOutput data={generated} onCritique={openCritic} />
      )}

      <CriticPanel
        open={criticOpen}
        initialText={criticInitial.text}
        initialType={criticInitial.type}
        campaignId={selectedId}
        onClose={() => setCriticOpen(false)}
      />
    </div>
  )
}

// Carga el diagnóstico standalone cuando aún no se ha generado nada
function DiagnosisOnly({ campaignId }: { campaignId: string }) {
  const [d, setD] = useState<GeneratedCreatives['diagnosis'] | null>(null)

  useEffect(() => {
    setD(null)
    fetch(`/api/creative/generate?campaignId=${encodeURIComponent(campaignId)}`)
      .then(r => r.json())
      .then(json => {
        if (json.state === 'loaded' && json.diagnosis) setD(json.diagnosis)
      })
      .catch(() => {})
  }, [campaignId])

  if (!d) return null
  return <CreativeDiagnosis diagnosis={d} />
}
