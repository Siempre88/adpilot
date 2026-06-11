// AdPilot — Meta layer: normalización y mapeo de payloads crudos.
// Sin acceso a red, sin lógica de scoring. Solo conversiones puras.

import type { DatePreset, MetaInsightAction } from './types'

export function parseNum(val: string | undefined, fallback = 0): number {
  if (!val) return fallback
  const n = parseFloat(val)
  return isNaN(n) ? fallback : Math.round(n * 100) / 100
}

export function daysFromPreset(preset: DatePreset): number {
  const map: Record<DatePreset, number> = {
    today: 1,
    yesterday: 1,
    last_3d: 3,
    last_7d: 7,
    last_14d: 14,
    last_30d: 30,
    last_90d: 90,
    maximum: 365,
  }
  return map[preset] ?? 7
}

export function extractAction(actions: MetaInsightAction[] | undefined, type: string): number {
  if (!actions) return 0
  const variants = [type, `offsite_conversion.fb_pixel_${type}`, `omni_${type}`]
  for (const t of variants) {
    const found = actions.find((a) => a.action_type === t)
    if (found) return parseNum(found.value)
  }
  return 0
}

export function extractConversions(actions: MetaInsightAction[] | undefined): number {
  if (!actions) return 0
  const convTypes = [
    'purchase',
    'lead',
    'complete_registration',
    'initiate_checkout',
    'offsite_conversion.fb_pixel_purchase',
    'offsite_conversion.fb_pixel_lead',
    'omni_purchase',
    'onsite_conversion.messaging_conversation_started_7d',
  ]
  let total = 0
  for (const a of actions) {
    if (convTypes.includes(a.action_type)) total += parseNum(a.value)
  }
  return total
}

export function extractRevenue(actionValues: MetaInsightAction[] | undefined): number {
  if (!actionValues) return 0
  const revTypes = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']
  for (const a of actionValues) {
    if (revTypes.includes(a.action_type)) return parseNum(a.value)
  }
  return 0
}

export function mapDeliveryStatus(effectiveStatus: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
    ADSET_PAUSED: 'ADSET_PAUSED',
    IN_PROCESS: 'LEARNING',
    WITH_ISSUES: 'WITH_ISSUES',
    LEARNING_LIMITED: 'LEARNING_LIMITED',
  }
  return map[effectiveStatus] ?? effectiveStatus
}

export function mapObjective(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_SALES: 'OUTCOME_SALES',
    OUTCOME_LEADS: 'OUTCOME_LEADS',
    OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
    OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
    CONVERSIONS: 'OUTCOME_SALES',
    LEAD_GENERATION: 'OUTCOME_LEADS',
    LINK_CLICKS: 'OUTCOME_TRAFFIC',
    POST_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    REACH: 'OUTCOME_AWARENESS',
    BRAND_AWARENESS: 'OUTCOME_AWARENESS',
    MESSAGES: 'OUTCOME_ENGAGEMENT',
    VIDEO_VIEWS: 'OUTCOME_AWARENESS',
  }
  return map[objective] ?? 'OUTCOME_SALES'
}
