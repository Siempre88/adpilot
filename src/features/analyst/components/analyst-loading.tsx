'use client'

import { Loader2 } from 'lucide-react'

export function AnalystLoading() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-white/50">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
      <span>Analizando campañas...</span>
    </div>
  )
}
