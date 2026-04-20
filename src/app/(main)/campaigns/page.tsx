'use client'

import { CampaignsTable } from '@/features/campaigns/components/campaigns-table'
import { usePlan } from '@/shared/lib/plan-context'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function CampaignsPage() {
  const { isPro, limits } = usePlan()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campañas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isPro ? 'Todas tus campañas con métricas detalladas' : `Mostrando ${limits.max_campaigns_visible} de tus campañas`}
          </p>
        </div>
        {!isPro && (
          <Link href="/settings"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            <Zap className="h-3.5 w-3.5" /> Ver todas las campañas
          </Link>
        )}
      </div>
      <CampaignsTable maxCampaigns={isPro ? undefined : limits.max_campaigns_visible} />
    </div>
  )
}
