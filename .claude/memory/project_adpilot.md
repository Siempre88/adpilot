---
name: AdPilot - Estado del Proyecto
description: FASE 1 + FASE 2 + FASE 3 completadas. Auth, sync, automation engine.
type: project
---

**AdPilot** — SaaS de análisis y automatización de campañas de Facebook Ads con IA.

## Estado: FASE 1 + FASE 2 + FASE 3 COMPLETADAS

### FASE 1 (Auth + Multiusuario):
- Supabase Auth, middleware, login/signup, onboarding
- Tokens Meta por usuario en DB, RLS, plan desde DB

### FASE 2 (Persistencia + Sync):
- sync-service.ts con lock + rate limit
- Dashboard lee de Supabase, sync en background
- Campaigns, insights, recommendations, alerts persistidos

### FASE 3 (Motor de Ejecución):
- automation_settings: config por usuario (kill switch, thresholds, cool-down)
- automation_rules: 5 reglas predeterminadas + custom
- action_queue: cola con idempotency hash, approval flow, expiration
- action_log: audit trail inmutable con before/after/rule context
- rule-engine.ts: evalúa reglas post-sync, verifica conflictos/cool-down/budget
- action-executor.ts: ejecuta como dry_run (FASE 3), con timeout protection
- Approval Center: aprobar/rechazar acciones pendientes
- Action Log: historial completo
- Automation Settings: toggles para auto-pause, auto-scale, budget limit
- Sidebar badge con count de pendientes
- Gated por plan (FREE no ve automation)
- NINGUNA escritura a Meta API (todo dry_run)

### Archivos clave FASE 3:
- src/lib/rule-engine.ts
- src/lib/action-executor.ts
- src/app/api/automation/settings/route.ts
- src/app/api/automation/rules/route.ts
- src/app/api/actions/pending/route.ts
- src/app/api/actions/approve/route.ts
- src/app/api/actions/reject/route.ts
- src/app/api/actions/log/route.ts
- src/app/(main)/automation/page.tsx

### Siguiente: FASE 4 (Pagos + Deploy + Escritura real a Meta)
