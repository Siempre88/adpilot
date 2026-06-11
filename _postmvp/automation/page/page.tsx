'use client'

import { useEffect, useState } from 'react'
import { usePlan } from '@/shared/lib/plan-context'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Zap, Shield, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Play, Pause, TrendingUp, Palette, Target, Bell, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'

interface ActionItem {
  id: string; campaign_name: string; action_type: string; reason: string;
  impact_value: number; impact_type: string; priority: number; created_at: string;
}

interface LogItem {
  id: string; campaign_name: string; action_type: string; status: string;
  impact_value: number; result: Record<string, unknown>; executed_at: string; execution_mode: string;
}

interface AutoSettings {
  automation_enabled: boolean; auto_pause_enabled: boolean; auto_pause_threshold: number;
  auto_scale_enabled: boolean; auto_scale_max_increase: number; budget_limit_daily: number;
  approval_required: boolean; cool_down_minutes: number;
}

const actionIcons: Record<string, typeof Pause> = {
  PAUSE: Pause, SCALE: TrendingUp, REVIEW_CREATIVE: Palette,
  REVIEW_TARGETING: Target, NOTIFY: Bell,
}
const actionColors: Record<string, string> = {
  PAUSE: 'text-red-400', SCALE: 'text-green-400', REVIEW_CREATIVE: 'text-purple-400',
  REVIEW_TARGETING: 'text-orange-400', NOTIFY: 'text-blue-400',
}

export default function AutomationPage() {
  const { isPro } = usePlan()
  const [tab, setTab] = useState<'pending' | 'log' | 'settings'>('pending')
  const [pending, setPending] = useState<ActionItem[]>([])
  const [log, setLog] = useState<LogItem[]>([])
  const [settings, setSettings] = useState<AutoSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/actions/pending').then(r => r.json()),
      fetch('/api/actions/log').then(r => r.json()),
      fetch('/api/automation/settings').then(r => r.json()),
    ]).then(([p, l, s]) => {
      setPending(p.actions || [])
      setLog(l.log || [])
      setSettings(s.settings)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleApprove(id: string) {
    await fetch('/api/actions/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId: id }) })
    setPending(p => p.filter(a => a.id !== id))
    const logRes = await fetch('/api/actions/log').then(r => r.json())
    setLog(logRes.log || [])
  }

  async function handleReject(id: string) {
    await fetch('/api/actions/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId: id }) })
    setPending(p => p.filter(a => a.id !== id))
  }

  async function saveSettings(updates: Partial<AutoSettings>) {
    setSaving(true)
    const merged = { ...settings, ...updates }
    await fetch('/api/automation/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) })
    setSettings(merged as AutoSettings)
    setSaving(false)
  }

  if (!isPro) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Zap className="h-10 w-10 text-blue-400" />
        <h2 className="text-lg font-bold text-white">Automatización disponible en Pro</h2>
        <p className="text-sm text-zinc-400">Motor de reglas, aprobaciones y ejecución inteligente.</p>
        <Link href="/settings" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          Upgrade a Pro
        </Link>
      </div>
    )
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>

  const tabs = [
    { key: 'pending' as const, label: 'Pendientes', count: pending.length },
    { key: 'log' as const, label: 'Historial', count: log.length },
    { key: 'settings' as const, label: 'Configuración', count: 0 },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Zap className="h-6 w-6 text-blue-400" /> Automatización</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Motor de reglas, aprobaciones y ejecución controlada</p>
        </div>
        {settings && (
          <button onClick={() => saveSettings({ automation_enabled: !settings.automation_enabled })}
            className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
              settings.automation_enabled ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {settings.automation_enabled ? <><CheckCircle2 className="h-3.5 w-3.5" /> Activo</> : <><Shield className="h-3.5 w-3.5" /> Desactivado</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="glass flex gap-1 rounded-full p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all',
              tab === t.key ? 'bg-white/[0.10] text-white shadow-glow-blue' : 'text-zinc-400 hover:text-white')}>
            {t.label}
            {t.count > 0 && <span className="rounded-full bg-blue-500/25 border border-blue-400/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-200 tabular-nums">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* PENDING */}
      {tab === 'pending' && (
        <div className="space-y-2">
          {pending.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-400" />
              <p className="mt-2 text-sm text-zinc-400">Sin acciones pendientes</p>
            </div>
          ) : pending.map(a => {
            const Icon = actionIcons[a.action_type] || Bell
            const color = actionColors[a.action_type] || 'text-zinc-400'
            return (
              <div key={a.id} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', color)} />
                    <div>
                      <p className="text-sm font-medium text-white">{a.campaign_name}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{a.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.impact_value > 0 && (
                      <span className={cn('text-xs font-bold', a.impact_type === 'loss_prevention' ? 'text-red-400' : 'text-green-400')}>
                        {formatCurrency(a.impact_value)}/día
                      </span>
                    )}
                    <button onClick={() => handleApprove(a.id)} className="glass-success rounded-full px-3.5 py-1.5 text-xs font-semibold text-green-200 hover:bg-green-500/25 transition-colors">Aprobar</button>
                    <button onClick={() => handleReject(a.id)} className="glass rounded-full px-3.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08] transition-colors">Rechazar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LOG */}
      {tab === 'log' && (
        <div className="glass rounded-2xl">
          {log.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">Sin historial de acciones</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {log.map(l => {
                const Icon = actionIcons[l.action_type] || Bell
                return (
                  <div key={l.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-zinc-500" />
                      <div>
                        <p className="text-xs font-medium text-white">{l.campaign_name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {l.action_type} · {l.execution_mode} · {new Date(l.executed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold',
                        l.status === 'dry_run' ? 'bg-blue-400/10 text-blue-400' : l.status === 'success' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400')}>
                        {l.status}
                      </span>
                      {l.impact_value > 0 && <span className="text-[10px] text-zinc-500">{formatCurrency(l.impact_value)}/día</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && settings && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Control General</h3>
            <Toggle label="Automatización activa" value={settings.automation_enabled} onChange={v => saveSettings({ automation_enabled: v })} />
            <Toggle label="Requiere aprobación manual" value={settings.approval_required} onChange={v => saveSettings({ approval_required: v })} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Auto-Pausar</h3>
            <Toggle label="Pausar campañas zombie automáticamente" value={settings.auto_pause_enabled} onChange={v => saveSettings({ auto_pause_enabled: v })} />
            <NumberInput label="Umbral de gasto ($)" value={settings.auto_pause_threshold} onChange={v => saveSettings({ auto_pause_threshold: v })} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Auto-Escalar</h3>
            <Toggle label="Escalar ganadoras automáticamente" value={settings.auto_scale_enabled} onChange={v => saveSettings({ auto_scale_enabled: v })} />
            <NumberInput label="Incremento máximo (%)" value={settings.auto_scale_max_increase} onChange={v => saveSettings({ auto_scale_max_increase: v })} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Límites de Seguridad</h3>
            <NumberInput label="Presupuesto diario de cambios ($)" value={settings.budget_limit_daily} onChange={v => saveSettings({ budget_limit_daily: v })} />
            <NumberInput label="Cool-down entre acciones (min)" value={settings.cool_down_minutes} onChange={v => saveSettings({ cool_down_minutes: v })} />
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-300">{label}</span>
      <button onClick={() => onChange(!value)}
        className={cn('relative h-5 w-9 rounded-full transition-colors', value ? 'bg-blue-600' : 'bg-zinc-700')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', value ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-300">{label}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-right text-xs text-white outline-none focus:border-blue-500" />
    </div>
  )
}
