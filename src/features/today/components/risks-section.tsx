'use client'

import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { SignalSeverity, SignalType } from '@/shared/types/database'
import type { RiskCard } from '../types'

const SIGNAL_LABELS: Record<SignalType, string> = {
  zombie_campaign:     'Campaña zombie',
  creative_fatigue:    'Fatiga creativa',
  high_cpa:            'CPA alto',
  low_ctr:             'CTR bajo',
  ready_to_scale:      'Lista para escalar',
  landing_problem:     'Problema en landing',
  audience_saturation: 'Audiencia saturada',
  overspend:           'Gasto desproporcionado',
  underspend:          'Gasto bajo',
  learning_limited:    'Aprendizaje limitado',
}

const SEVERITY_TINT: Record<SignalSeverity, { bg: string; text: string }> = {
  critical: { bg: 'glass-danger',  text: 'text-red-300' },
  high:     { bg: 'glass-danger',  text: 'text-red-300' },
  medium:   { bg: 'glass-warning', text: 'text-amber-300' },
  low:      { bg: 'glass',         text: 'text-blue-300' },
}

export function RisksSection({ risks }: { risks: RiskCard[] }) {
  if (risks.length === 0) {
    return (
      <Section>
        <p className="text-xs text-white/40">Sin campañas en riesgo. Todo bajo control.</p>
      </Section>
    )
  }

  return (
    <Section count={risks.length}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {risks.map(r => <Card key={r.campaign_id} r={r} />)}
      </div>
    </Section>
  )
}

function Section({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-300" />
        <h2 className="text-sm font-bold tracking-tight text-white">Necesitan atención</h2>
        {count !== undefined && <span className="text-[10px] text-white/40">· {count} {count === 1 ? 'campaña' : 'campañas'}</span>}
      </div>
      {children}
    </section>
  )
}

function Card({ r }: { r: RiskCard }) {
  const sev = r.primary_signal ? SEVERITY_TINT[r.primary_signal.severity] : SEVERITY_TINT.medium
  const signalLabel = r.primary_signal ? SIGNAL_LABELS[r.primary_signal.type] : 'Métricas en riesgo'

  return (
    <div className={cn('glass-hover rounded-xl p-4', sev.bg)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-white" title={r.campaign_name}>{r.campaign_name}</h3>
        <span className={cn(
          'rounded-full border border-white/[0.10] bg-black/30 px-2 py-0.5 text-[10px] font-bold tabular-nums',
          r.score >= 50 ? 'text-amber-300' : 'text-red-300'
        )}>
          {r.score}/100
        </span>
      </div>

      {/* Primary signal */}
      <div className="mt-3 flex items-start gap-2">
        <span className={cn('mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full', sev.text.replace('text-', 'bg-'))} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', sev.text)}>{signalLabel}</p>
          {r.primary_signal && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/65">
              {r.primary_signal.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Acción</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-medium text-white/85">{r.recommendation_short}</p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[10px]">
        <span className="text-white/40">{formatCurrency(r.spend)} gastados</span>
        {r.signals_count > 1 && (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-white/50">
            +{r.signals_count - 1} {r.signals_count - 1 === 1 ? 'señal' : 'señales'}
          </span>
        )}
        <Link
          href={`/campaigns?id=${encodeURIComponent(r.campaign_id)}`}
          className="flex items-center gap-1 text-white/60 transition-colors hover:text-white"
        >
          Detalle <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
