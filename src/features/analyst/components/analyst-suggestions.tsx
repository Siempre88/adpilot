'use client'

import { cn } from '@/lib/utils'
import { AlertOctagon, TrendingUp, Palette, Target, Wallet } from 'lucide-react'
import type { QuickSuggestion } from '../types'

const SUGGESTIONS: (QuickSuggestion & { icon: typeof AlertOctagon; color: string })[] = [
  { label: '¿Cuál es mi peor campaña?', prompt: '¿Cuál es mi peor campaña ahora mismo y por qué?', icon: AlertOctagon, color: 'text-red-300' },
  { label: '¿Dónde estoy perdiendo dinero?', prompt: '¿Dónde estoy perdiendo dinero hoy?', icon: Wallet, color: 'text-red-300' },
  { label: '¿Qué debería escalar?', prompt: '¿Qué campaña está lista para escalar y cuánto subo el presupuesto?', icon: TrendingUp, color: 'text-emerald-300' },
  { label: '¿Qué creativo está fatigado?', prompt: '¿Qué campañas tienen fatiga creativa y qué hago?', icon: Palette, color: 'text-purple-300' },
  { label: '¿Qué harías tú hoy?', prompt: 'Si fueras yo, ¿qué harías hoy con mis campañas? Dame las 3 acciones priorizadas.', icon: Target, color: 'text-amber-300' },
]

export function AnalystSuggestions({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
      {SUGGESTIONS.map(s => {
        const Icon = s.icon
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="glass glass-hover flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/80"
          >
            <Icon className={cn('h-4 w-4 shrink-0', s.color)} />
            <span className="truncate">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
