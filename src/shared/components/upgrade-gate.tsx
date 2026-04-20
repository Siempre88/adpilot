'use client'

import { formatCurrency } from '@/lib/utils'
import { Lock, Zap } from 'lucide-react'
import { usePlan } from '@/shared/lib/plan-context'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface UpgradeGateProps {
  feature: string
  children: ReactNode
  impactValue?: number
  teaser?: ReactNode
}

export function UpgradeGate({ feature, children, impactValue, teaser }: UpgradeGateProps) {
  const { isPro } = usePlan()

  if (isPro) return <>{children}</>

  return (
    <div className="glass-info rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.12]">
            <Lock className="h-4 w-4 text-blue-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{feature}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {impactValue && impactValue > 0
                ? <>Desbloquea y gana hasta <span className="text-green-300 font-medium">{formatCurrency(impactValue * 30)}/mes</span></>
                : 'Disponible en el plan Pro'}
            </p>
          </div>
        </div>
        <Link href="/settings" className="btn-glass flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white">
          <Zap className="h-3.5 w-3.5" />
          Upgrade
        </Link>
      </div>
    </div>
  )
}
