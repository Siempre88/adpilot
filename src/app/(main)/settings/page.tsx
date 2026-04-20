'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Settings, CheckCircle2, XCircle, AlertTriangle, Loader2,
  KeyRound, Link2, RefreshCw, Eye, EyeOff, Clock,
} from 'lucide-react'

type MetaStatus = 'connected' | 'expired' | 'invalid' | 'missing' | null

interface ConnectionState {
  status: MetaStatus
  account_id: string | null
  account_name?: string
  expires?: string | null
  message: string
}

export default function SettingsPage() {
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [token, setToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/meta')
      const data = await res.json()
      setConnection(data)
    } catch {
      setConnection({ status: 'invalid', account_id: null, message: 'Error al verificar' })
    }
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

  async function handleConnect() {
    if (!token.trim() || !accountId.trim()) {
      setResult({ ok: false, message: 'Token y Account ID son requeridos' })
      return
    }
    setConnecting(true)
    setResult(null)
    try {
      const res = await fetch('/api/settings/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), accountId: accountId.trim() }),
      })
      const data = await res.json()
      setResult({ ok: data.ok, message: data.message })
      if (data.ok) {
        setToken('')
        setAccountId('')
        await loadStatus()
      }
    } catch {
      setResult({ ok: false, message: 'Error de conexión' })
    }
    setConnecting(false)
  }

  const statusConfig = {
    connected: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/20', label: 'Conectado' },
    expired: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-500/20', label: 'Expirado' },
    invalid: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/20', label: 'Inválido' },
    missing: { icon: Link2, color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-700', label: 'Sin conectar' },
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Settings className="h-6 w-6 text-zinc-400" />
          Configuración
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">Conecta tu cuenta de Meta Ads</p>
      </div>

      {/* Connection Status */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Estado de Conexión</h2>

        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-sm text-zinc-400">Verificando conexión...</span>
          </div>
        ) : connection ? (
          <div className="space-y-3">
            {/* Status badge */}
            {(() => {
              const cfg = statusConfig[connection.status || 'missing']
              const Icon = cfg.icon
              return (
                <div className={cn('flex items-center justify-between rounded-lg border p-4', cfg.border, cfg.bg)}>
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', cfg.color)} />
                    <div>
                      <p className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</p>
                      <p className="text-xs text-zinc-400">{connection.message}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {connection.account_id && (
                      <p className="text-xs font-mono text-zinc-300">{connection.account_id}</p>
                    )}
                    {connection.account_name && connection.account_name !== connection.account_id && (
                      <p className="text-[10px] text-zinc-500">{connection.account_name}</p>
                    )}
                    {connection.expires && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                        <Clock className="h-2.5 w-2.5" />
                        Expira: {new Date(connection.expires).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Refresh button */}
            <button onClick={loadStatus}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              <RefreshCw className="h-3 w-3" /> Verificar de nuevo
            </button>
          </div>
        ) : null}
      </div>

      {/* Connect Form */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">
          {connection?.status === 'connected' ? 'Actualizar conexión' : 'Conectar cuenta de Meta Ads'}
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          {connection?.status === 'connected'
            ? 'Reemplaza el token si expiró o quieres usar otra cuenta'
            : 'Ingresa tu Access Token y Ad Account ID para conectar'}
        </p>

        <div className="space-y-3">
          {/* Token input */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">Access Token</label>
            <div className="relative">
              <input value={token} onChange={e => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="EAAYYL8CIY5YB..."
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 pr-10 font-mono text-xs text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
              <button onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Obtén tu token en developers.facebook.com/tools/explorer
            </p>
          </div>

          {/* Account ID input */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">Ad Account ID</label>
            <input value={accountId} onChange={e => setAccountId(e.target.value)}
              placeholder="act_212677000"
              className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 font-mono text-xs text-white placeholder-white/30 outline-none transition-all focus:border-blue-400/50 focus:bg-white/[0.08]" />
            <p className="mt-1 text-[10px] text-zinc-600">
              Formato: act_ seguido de números
            </p>
          </div>

          {/* Result message */}
          {result && (
            <div className={cn('rounded-lg px-3 py-2 text-xs',
              result.ok ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400')}>
              {result.ok ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : <XCircle className="mr-1 inline h-3 w-3" />}
              {result.message}
            </div>
          )}

          {/* Connect button */}
          <button onClick={handleConnect} disabled={connecting || !token.trim() || !accountId.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {connecting ? 'Conectando...' : connection?.status === 'connected' ? 'Actualizar conexión' : 'Conectar'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Información</h2>
        <div className="space-y-2 text-xs text-zinc-400">
          <p>• El token de Graph API Explorer expira en ~1 hora</p>
          <p>• Para un token estable, usa un System User Token (no expira)</p>
          <p>• Tu token nunca se envía al navegador — solo se usa en el backend</p>
          <p>• Permisos necesarios: <code className="rounded bg-zinc-800 px-1 text-[10px]">ads_read</code></p>
        </div>
      </div>
    </div>
  )
}
