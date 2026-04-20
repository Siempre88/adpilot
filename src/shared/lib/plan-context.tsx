'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { PLAN_CONFIG, type PlanTier, type PlanLimits } from '@/shared/types/database'

interface PlanContextType {
  plan: PlanTier
  limits: PlanLimits
  isPro: boolean
  loading: boolean
  canAccess: (feature: keyof PlanLimits) => boolean
}

const PlanContext = createContext<PlanContextType | null>(null)

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.profile?.plan) {
          setPlan(data.profile.plan as PlanTier)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const limits = PLAN_CONFIG[plan]
  const isPro = plan === 'pro'

  const canAccess = (feature: keyof PlanLimits) => {
    const val = limits[feature]
    if (typeof val === 'boolean') return val
    if (typeof val === 'number') return val > 1
    return true
  }

  return (
    <PlanContext.Provider value={{ plan, limits, isPro, loading, canAccess }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within PlanProvider')
  return ctx
}
