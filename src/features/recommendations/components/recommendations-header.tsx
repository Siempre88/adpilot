'use client'

import { Compass } from 'lucide-react'

export function RecommendationsHeader() {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-hero p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="logo-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <Compass className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Centro de recomendaciones
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Decisiones claras para mejorar tus campañas.
          </p>
        </div>
      </div>
    </div>
  )
}
