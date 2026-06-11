// AdPilot — Meta layer: raw Graph API payload types + presets.
// Solo describe lo que Meta devuelve. Sin lógica de negocio.

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  effective_status: string
  created_time: string
  updated_time: string
}

export interface MetaInsightAction {
  action_type: string
  value: string
}

export interface MetaInsight {
  campaign_id: string
  campaign_name: string
  impressions: string
  clicks: string
  spend: string
  reach: string
  frequency: string
  cpc?: string
  cpm?: string
  ctr: string
  actions?: MetaInsightAction[]
  action_values?: MetaInsightAction[]
  cost_per_action_type?: MetaInsightAction[]
  date_start: string
  date_stop: string
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_3d'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'maximum'
