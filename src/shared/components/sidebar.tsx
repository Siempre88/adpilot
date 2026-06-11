'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePlan } from '@/shared/lib/plan-context'
import { createClient } from '@/lib/db/supabase/client'
import {
  Sun,
  Compass,
  Megaphone,
  Sparkles,
  Settings,
  Zap,
  Crown,
  LogOut,
} from 'lucide-react'

const navigation = [
  { name: 'Today', href: '/today', icon: Sun },
  { name: 'Recomendaciones', href: '/recommendations', icon: Compass },
  { name: 'Campañas', href: '/campaigns', icon: Megaphone },
  { name: 'Creative Lab', href: '/creative-lab', icon: Sparkles },
  { name: 'Analyst', href: '/analyst', icon: Zap },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isPro } = usePlan()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="glass-strong flex h-screen w-64 shrink-0 flex-col sticky top-0 rounded-none border-l-0 border-t-0 border-b-0 border-r border-white/[0.08]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-6">
        <div className="logo-glow flex h-9 w-9 items-center justify-center rounded-xl">
          <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">AdPilot</span>
        <span className={cn(
          'ml-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider',
          isPro
            ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-500/30'
            : 'bg-white/[0.06] text-zinc-400 border border-white/[0.08]'
        )}>
          {isPro ? 'PRO' : 'FREE'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                isActive
                  ? 'glass-info text-white shadow-glow-blue'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              )}>
              <item.icon className={cn(
                'h-[18px] w-[18px] transition-colors',
                isActive ? 'text-blue-300' : 'text-zinc-500 group-hover:text-zinc-300'
              )} />
              <span className="flex-1">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Upgrade CTA (free users) */}
      {!isPro && (
        <div className="px-3 pb-2">
          <Link href="/settings"
            className="glass-info glass-hover flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left">
            <Crown className="h-4 w-4 text-amber-300" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Upgrade a Pro</p>
              <p className="truncate text-[10px] text-zinc-400">Plan completo + IA ilimitada</p>
            </div>
          </Link>
        </div>
      )}

      {/* Footer: logout */}
      <div className="border-t border-white/[0.06] p-3">
        <button onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-200">
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
