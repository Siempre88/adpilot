'use client'

import { ChatInterface } from '@/features/chat/components/chat-interface'
import { usePlan } from '@/shared/lib/plan-context'
import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'

export default function ChatPage() {
  const { isPro, limits } = usePlan()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat con IA</h1>
          <p className="mt-1 text-sm text-zinc-400">Pregunta sobre tus campañas y recibe análisis con datos reales</p>
        </div>
        {!isPro && (
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-[11px] text-zinc-400">
            {limits.chat_messages_per_day} mensajes/día en plan Free
          </span>
        )}
      </div>
      <ChatInterface />
      {!isPro && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-zinc-900/80 p-6 text-center">
          <Lock className="mx-auto h-5 w-5 text-blue-400" />
          <p className="mt-2 text-sm font-semibold text-white">Chat IA limitado a {limits.chat_messages_per_day} mensajes/día</p>
          <p className="mt-1 text-xs text-zinc-400">Upgrade a Pro para análisis ilimitado</p>
          <Link href="/settings"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            <Zap className="h-3.5 w-3.5" /> Upgrade a Pro
          </Link>
        </div>
      )}
    </div>
  )
}
