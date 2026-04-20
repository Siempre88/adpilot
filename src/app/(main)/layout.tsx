'use client'

import dynamic from 'next/dynamic'
import { PlanProvider } from '@/shared/lib/plan-context'

// Sidebar uses usePathname + usePlan (client-only hooks)
// Loading it with ssr:false prevents hydration mismatch
const Sidebar = dynamic(
  () => import('@/shared/components/sidebar').then(m => m.Sidebar),
  { ssr: false }
)

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PlanProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </PlanProvider>
  )
}
