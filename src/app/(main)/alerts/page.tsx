import { AlertsList } from '@/features/alerts/components/alerts-list'

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alertas Inteligentes</h1>
        <p className="mt-1 text-sm text-zinc-400">Problemas detectados automáticamente en tus campañas</p>
      </div>
      <AlertsList />
    </div>
  )
}
