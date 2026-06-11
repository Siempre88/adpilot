// AdPilot — Meta layer: cliente HTTP a Graph API v21.0.
// Solo lectura, sin lógica de negocio. Server-only (token NUNCA al frontend).

import type { DatePreset, MetaCampaign, MetaInsight } from './types'

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

let _requestToken = ''
let _requestAccountId = ''

export function setRequestCredentials(token: string, accountId: string): void {
  _requestToken = token
  _requestAccountId = accountId
}

function getConfig() {
  const token = _requestToken || process.env.META_ACCESS_TOKEN
  const accountId = _requestAccountId || process.env.META_AD_ACCOUNT_ID
  if (!token || !accountId) {
    throw new Error('No Meta credentials available. Connect your account in Settings.')
  }
  return { token, accountId }
}

export class MetaAuthError extends Error {
  status: 'expired' | 'invalid'
  constructor(message: string, status: 'expired' | 'invalid') {
    super(message)
    this.name = 'MetaAuthError'
    this.status = status
  }
}

async function graphFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { token } = getConfig()
  const url = new URL(`${GRAPH_API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  const json = await res.json()

  if (json.error) {
    const code = json.error.code
    const subcode = json.error.error_subcode
    console.error('[Meta Ads API Error]', json.error)

    if (code === 190 || code === 102) {
      const status: 'expired' | 'invalid' =
        subcode === 463 || subcode === 467 || subcode === 460 ? 'expired' : 'invalid'
      throw new MetaAuthError(json.error.message, status)
    }
    throw new Error(`Meta API: ${json.error.message}`)
  }

  return json as T
}

export async function validateMetaToken(): Promise<{
  status: 'connected' | 'expired' | 'invalid' | 'missing'
  message: string
}> {
  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID
  if (!token || !accountId) {
    return { status: 'missing', message: 'META_ACCESS_TOKEN o META_AD_ACCOUNT_ID no configurados' }
  }
  try {
    const res = await fetch(`${GRAPH_API_BASE}/debug_token?input_token=${token}&access_token=${token}`)
    const json = await res.json()
    if (json.error) {
      if (json.error.code === 190) return { status: 'expired', message: 'Token expirado o sesión inválida' }
      return { status: 'invalid', message: json.error.message }
    }
    const data = json.data
    if (!data?.is_valid) return { status: 'expired', message: 'Token inválido o expirado' }
    return {
      status: 'connected',
      message: `Token válido. Expira: ${data.expires_at ? new Date(data.expires_at * 1000).toLocaleDateString() : 'nunca'}`,
    }
  } catch {
    return { status: 'invalid', message: 'No se pudo validar el token' }
  }
}

export async function getCampaigns(): Promise<MetaCampaign[]> {
  const { accountId } = getConfig()
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,effective_status,created_time,updated_time'
  const data = await graphFetch<{ data: MetaCampaign[] }>(`/${accountId}/campaigns`, {
    fields,
    limit: '100',
  })
  return data.data ?? []
}

const INSIGHT_FIELDS = [
  'campaign_id',
  'campaign_name',
  'impressions',
  'clicks',
  'spend',
  'reach',
  'frequency',
  'cpc',
  'cpm',
  'ctr',
  'actions',
  'action_values',
  'cost_per_action_type',
].join(',')

export async function getCampaignInsightsRaw(datePreset: DatePreset = 'last_7d'): Promise<MetaInsight[]> {
  const { accountId } = getConfig()
  const data = await graphFetch<{ data: MetaInsight[] }>(`/${accountId}/insights`, {
    fields: INSIGHT_FIELDS,
    level: 'campaign',
    date_preset: datePreset,
    limit: '500',
  })
  const results = data.data ?? []

  if (results.length === 0 && datePreset !== 'maximum') {
    console.log(`[Meta Ads] No insights for ${datePreset}, falling back to maximum`)
    const fallback = await graphFetch<{ data: MetaInsight[] }>(`/${accountId}/insights`, {
      fields: INSIGHT_FIELDS,
      level: 'campaign',
      date_preset: 'maximum',
      limit: '500',
    })
    return fallback.data ?? []
  }
  return results
}

export async function getCampaignInsightsDaily(
  campaignId: string,
  datePreset: DatePreset = 'last_7d'
): Promise<MetaInsight[]> {
  const dailyFields = `${INSIGHT_FIELDS},date_start,date_stop`
  const data = await graphFetch<{ data: MetaInsight[] }>(`/${campaignId}/insights`, {
    fields: dailyFields,
    date_preset: datePreset,
    time_increment: '1',
    limit: '100',
  })
  const results = data.data ?? []

  if (results.length === 0 && datePreset !== 'maximum') {
    const fallback = await graphFetch<{ data: MetaInsight[] }>(`/${campaignId}/insights`, {
      fields: dailyFields,
      date_preset: 'maximum',
      time_increment: '1',
      limit: '100',
    })
    return fallback.data ?? []
  }
  return results
}
