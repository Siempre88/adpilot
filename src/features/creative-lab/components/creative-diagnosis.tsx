'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, Lightbulb, Crosshair, Activity } from 'lucide-react'
import type { SignalSeverity } from '@/shared/types/database'
import type { CreativeDiagnosis as Diag } from '../types'

const SEVERITY_TINT: Record<SignalSeverity, string> = {
  critical: 'glass-danger',
  high: 'glass-danger',
  medium: 'glass-warning',
  low: 'glass-info',
}

export function CreativeDiagnosis({ diagnosis }: { diagnosis: Diag }) {
  const tint = SEVERITY_TINT[diagnosis.severity]

  return (
    <section className={cn('rounded-2xl p-5', tint)}>
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-bold tracking-tight text-white">Diagnóstico creativo</h2>
        <span className="text-[10px] text-white/40">· {diagnosis.campaign_name}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item
          icon={AlertTriangle}
          label="Problema"
          text={diagnosis.problem}
          color="text-red-300"
        />
        <Item
          icon={Activity}
          label="Métrica afectada"
          text={diagnosis.affected_metric}
          color="text-amber-300"
        />
        <Item
          icon={Lightbulb}
          label="Causa probable"
          text={diagnosis.probable_cause}
          color="text-blue-300"
        />
        <Item
          icon={Crosshair}
          label="Objetivo creativo"
          text={diagnosis.creative_goal}
          color="text-emerald-300"
        />
      </div>
    </section>
  )
}

function Item({
  icon: Icon, label, text, color,
}: {
  icon: typeof AlertTriangle
  label: string
  text: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', color)} />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/85">{text}</p>
    </div>
  )
}
