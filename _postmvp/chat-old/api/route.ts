import { streamText, stepCountIs } from 'ai'
import { z } from 'zod'
import { getModel, rotateModel } from '@/lib/ai/model'
import { ANALYST_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { withMetaAuth } from '@/lib/api-auth'
import { getCampaignInsightsDaily } from '@/lib/meta/client'
import {
  getCampaignsWithMetrics,
  getTopCampaigns,
  getWorstCampaigns,
  getAlerts,
  getDashboardSummary,
  getExecutiveSummary,
  simulateCampaignAction,
} from '@/lib/scoring'

const datePresetSchema = z.enum(['today', 'last_3d', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'maximum']).default('last_7d')

const adpilotTools = {
  getCampaigns: {
    description: 'Campañas reales con score, recomendación, impacto.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => {
      const campaigns = await getCampaignsWithMetrics(datePreset as any)
      return campaigns.map(c => ({
        name: c.name, id: c.id, score: c.score, classification: c.classification,
        recommendation: c.recommendation?.label, confidence: c.recommendation?.confidence,
        impact_value: c.impact?.value, impact_description: c.impact?.description,
        total_spend: c.total_spend, avg_ctr: c.avg_ctr, avg_cpc: c.avg_cpc,
        total_conversions: c.total_conversions, roas: c.roas, avg_frequency: c.avg_frequency,
      }))
    },
  },
  getCampaignInsights: {
    description: 'Insights diarios de una campaña.',
    parameters: z.object({ campaignId: z.string(), datePreset: datePresetSchema }),
    execute: async ({ campaignId, datePreset }: { campaignId: string; datePreset: string }) => {
      return { campaign_id: campaignId, daily_insights: await getCampaignInsightsDaily(campaignId, datePreset as any) }
    },
  },
  getTopCampaigns: {
    description: 'Mejores campañas.',
    parameters: z.object({ datePreset: datePresetSchema, limit: z.number().default(3) }),
    execute: async ({ datePreset, limit }: { datePreset: string; limit: number }) => {
      const top = await getTopCampaigns(datePreset as any, limit)
      return top.map(c => ({ name: c.name, score: c.score, avg_ctr: c.avg_ctr, total_spend: c.total_spend, impact_value: c.impact?.value }))
    },
  },
  getWorstCampaigns: {
    description: 'Peores campañas.',
    parameters: z.object({ datePreset: datePresetSchema, limit: z.number().default(3) }),
    execute: async ({ datePreset, limit }: { datePreset: string; limit: number }) => {
      const worst = await getWorstCampaigns(datePreset as any, limit)
      return worst.map(c => ({ name: c.name, score: c.score, avg_ctr: c.avg_ctr, total_spend: c.total_spend, impact_value: c.impact?.value }))
    },
  },
  getAlerts: {
    description: 'Alertas activas.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => {
      return (await getAlerts(datePreset as any)).map(a => ({ campaign_name: a.campaign_name, type: a.type, severity: a.severity, problem: a.problem, action: a.action }))
    },
  },
  getDashboardSummary: {
    description: 'KPIs generales.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => {
      const s = await getDashboardSummary(datePreset as any)
      return { total_spend: s.total_spend, avg_ctr: s.avg_ctr, avg_cpc: s.avg_cpc, active_campaigns: s.active_campaigns, winning: s.winning_campaigns, losing: s.losing_campaigns, daily_loss: s.daily_loss }
    },
  },
  getActionPlan: {
    description: 'Plan de acción diario.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => (await getExecutiveSummary(datePreset as any)).action_plan,
  },
  simulateAction: {
    description: 'Simula qué pasa si tomas una acción.',
    parameters: z.object({ campaignName: z.string(), action: z.enum(['SCALE', 'PAUSE', 'REVIEW_CREATIVE', 'REVIEW_TARGETING']), datePreset: datePresetSchema }),
    execute: async ({ campaignName, action, datePreset }: { campaignName: string; action: any; datePreset: string }) => {
      return await simulateCampaignAction(campaignName, action, datePreset as any)
    },
  },
}

export async function POST(req: Request) {
  const auth = await withMetaAuth()
  if ('error' in auth) return auth.error

  const { messages } = await req.json()

  try {
    const result = streamText({
      model: getModel(),
      system: ANALYST_SYSTEM_PROMPT,
      messages,
      tools: adpilotTools as any,
      stopWhen: stepCountIs(5),
      maxOutputTokens: 1500,
      timeout: 30000,
    })
    return result.toUIMessageStreamResponse()
  } catch {
    rotateModel()
    const result = streamText({
      model: getModel(),
      system: ANALYST_SYSTEM_PROMPT,
      messages,
      tools: adpilotTools as any,
      stopWhen: stepCountIs(5),
      maxOutputTokens: 1500,
      timeout: 30000,
    })
    return result.toUIMessageStreamResponse()
  }
}
