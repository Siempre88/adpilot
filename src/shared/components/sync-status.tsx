'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { RefreshCw, CheckCircle2, Clock } from 'lucide-react'

interface SyncState {
  last_sync: string | null
  stale: boolean
  syncing: boolean
}

export function SyncStatus({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [state, setState] = useState<SyncState>({ last_sync: null, stale: true, syncing: false })
  const [isSyncing, setIsSyncing] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status')
      const data = await res.json()
      setState(data)

      // Auto-sync if stale and not already syncing
      if (data.stale && !data.syncing && !isSyncing) {
        triggerSync()
      }
    } catch {}
  }, [isSyncing])

  useEffect(() => { checkStatus() }, [checkStatus])

  async function triggerSync() {
    setIsSyncing(true)
    setState(s => ({ ...s, syncing: true }))

    try {
      await fetch('/api/sync', { method: 'POST' })
      await checkStatus()
      onSyncComplete?.()
    } catch {}

    setIsSyncing(false)
    setState(s => ({ ...s, syncing: false }))
  }

  function formatTimeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return `hace ${min} min`
    const hours = Math.floor(min / 60)
    if (hours < 24) return `hace ${hours}h`
    return `hace ${Math.floor(hours / 24)}d`
  }

  const syncing = state.syncing || isSyncing

  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium">
        {syncing ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin text-blue-300" />
            <span className="text-blue-300">Sincronizando</span>
          </>
        ) : state.last_sync ? (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-zinc-300">{formatTimeAgo(state.last_sync)}</span>
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 text-zinc-500" />
            <span className="text-zinc-500">Sin sync</span>
          </>
        )}
      </div>

      {!syncing && (
        <button onClick={triggerSync} title="Actualizar datos"
          className={cn(
            'rounded-full p-1 text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-white'
          )}>
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
