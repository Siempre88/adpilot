'use client'

import { cn } from '@/lib/utils'
import { Loader2, Sparkles } from 'lucide-react'
import { ANGLE_LABELS, type CreativeAngle } from '../types'

interface GeneratorProps {
  angle: CreativeAngle
  onAngleChange: (a: CreativeAngle) => void
  onGenerate: () => void
  generating: boolean
  disabled?: boolean
}

const ANGLE_ORDER: CreativeAngle[] = [
  'auto', 'pain', 'benefit', 'social_proof', 'urgency', 'comparison', 'before_after', 'demonstration',
]

export function CreativeGenerator({ angle, onAngleChange, onGenerate, generating, disabled }: GeneratorProps) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">Generar creativos</h2>
          <p className="mt-0.5 text-xs text-white/55">
            5 hooks · 3 copies · 3 headlines · 3 CTAs · 2 scripts UGC
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || disabled}
          className="btn-glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-glow-blue disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Generando...' : 'Generar'}
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">Enfoque</p>
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_ORDER.map(a => {
            const active = angle === a
            return (
              <button
                key={a}
                type="button"
                onClick={() => onAngleChange(a)}
                disabled={generating}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-purple-400/40 bg-purple-500/15 text-purple-200'
                    : 'border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white'
                )}
              >
                {ANGLE_LABELS[a]}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
