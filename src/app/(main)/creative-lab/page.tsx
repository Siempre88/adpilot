'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CreativeLab } from '@/features/creative-lab/components/creative-lab'
import { Critic } from '@/features/creative-lab/components/critic'
import { Sparkles, ShieldAlert } from 'lucide-react'

const tabs = [
  { key: 'generate', label: 'Generar', icon: Sparkles, color: 'text-purple-400' },
  { key: 'critic', label: 'Critic', icon: ShieldAlert, color: 'text-red-400' },
] as const

export default function CreativeLabPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'critic'>('generate')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Sparkles className="h-6 w-6 text-purple-400" />
            Creative Lab
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Genera creativos basados en datos reales o evalúa los tuyos con el Critic
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-all',
                activeTab === t.key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              <t.icon className={cn('h-3.5 w-3.5', activeTab === t.key ? t.color : '')} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'generate' ? <CreativeLab /> : <Critic />}
    </div>
  )
}
