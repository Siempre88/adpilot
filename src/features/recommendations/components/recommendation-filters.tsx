'use client'

import { cn } from '@/lib/utils'
import type { FilterOption, RecommendationFilter } from '../types'

interface FiltersProps {
  options: FilterOption[]
  active: RecommendationFilter
  onChange: (key: RecommendationFilter) => void
}

export function RecommendationFilters({ options, active, onChange }: FiltersProps) {
  return (
    <div className="glass flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5">
      {options.map(opt => {
        const isActive = active === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'glass-info text-white shadow-glow-blue'
                : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <span>{opt.label}</span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
              isActive ? 'bg-blue-400/20 text-blue-200' : 'bg-white/[0.08] text-white/50'
            )}>
              {opt.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
