'use client'

import { Zap } from 'lucide-react'
import type { TodayAiSummary as Summary } from '../types'

export function AiSummary({ summary }: { summary: Summary }) {
  return (
    <div className="glass-info relative overflow-hidden rounded-2xl p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div className="logo-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300/80">
            Resumen del operador
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/90">
            {summary.text}
          </p>
        </div>
      </div>
    </div>
  )
}
