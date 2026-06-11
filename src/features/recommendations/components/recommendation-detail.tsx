'use client'

import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import { ArrowRight, Lightbulb, Target as TargetIcon, BookOpen } from 'lucide-react'
import type { SignalSeverity } from '@/shared/types/database'
import type { RecommendationDetail, WindowSnapshot } from '../types'

const SEVERITY_DOT: Record<SignalSeverity, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-blue-400',
}

const SEVERITY_TEXT: Record<SignalSeverity, string> = {
  critical: 'text-red-300',
  high: 'text-orange-300',
  medium: 'text-amber-300',
  low: 'text-blue-300',
}

export function RecommendationDetailPanel({ rec }: { rec: RecommendationDetail }) {
  return (
    <div className="border-t border-white/[0.08] px-5 py-4 space-y-4">
      {/* Reasoning */}
      <Section icon={BookOpen} label="Razonamiento">
        <p className="text-xs leading-relaxed text-white/75">{rec.reasoning}</p>
      </Section>

      {/* Signals detected */}
      {rec.signals.length > 0 && (
        <Section icon={Lightbulb} label={`Señales detectadas (${rec.signals.length})`}>
          <ul className="space-y-1.5">
            {rec.signals.map(s => (
              <li key={s.type} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <span className={cn('mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[s.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-white/90">{s.type_label}</p>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', SEVERITY_TEXT[s.severity])}>
                      {s.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/55">{s.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Time windows */}
      <Section icon={TargetIcon} label="Comparación temporal">
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-3 py-1.5 text-left font-semibold">Ventana</th>
                <th className="px-3 py-1.5 text-right font-semibold">Spend</th>
                <th className="px-3 py-1.5 text-right font-semibold">CTR</th>
                <th className="px-3 py-1.5 text-right font-semibold">{rec.metrics.hasRevenue ? 'ROAS' : 'CPC'}</th>
                <th className="px-3 py-1.5 text-right font-semibold">Conv</th>
              </tr>
            </thead>
            <tbody>
              {rec.windows.map(w => <WindowRow key={w.window} w={w} hasRevenue={rec.metrics.hasRevenue} />)}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Next step */}
      <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-3.5 w-3.5 text-blue-300" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/90">Siguiente paso</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/85">{rec.next_step}</p>
      </div>
    </div>
  )
}

function Section({ icon: Icon, label, children }: { icon: typeof BookOpen; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/50" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
      </div>
      {children}
    </section>
  )
}

function WindowRow({ w, hasRevenue }: { w: WindowSnapshot; hasRevenue: boolean }) {
  const isEmpty = w.daysCovered === 0
  return (
    <tr className="border-t border-white/[0.04] tabular-nums">
      <td className="px-3 py-2 font-semibold text-white/80">
        {w.window}
        {isEmpty && <span className="ml-1.5 text-[10px] text-white/30">(sin datos)</span>}
      </td>
      <td className={cn('px-3 py-2 text-right', isEmpty ? 'text-white/25' : 'text-white/75')}>{formatCurrency(w.spend)}</td>
      <td className={cn('px-3 py-2 text-right', isEmpty ? 'text-white/25' : 'text-white/75')}>{formatPercent(w.ctr)}</td>
      <td className={cn('px-3 py-2 text-right', isEmpty ? 'text-white/25' : 'text-white/75')}>
        {hasRevenue ? `${w.roas.toFixed(2)}x` : `$${w.cpc.toFixed(2)}`}
      </td>
      <td className={cn('px-3 py-2 text-right', isEmpty ? 'text-white/25' : 'text-white/75')}>{w.conversions}</td>
    </tr>
  )
}
