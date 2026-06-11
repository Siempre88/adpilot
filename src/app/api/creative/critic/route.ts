import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { streamCritique } from '@/features/creative-lab/services/creative-lab-service'

const VALID_TYPES = ['hook', 'copy', 'headline', 'cta', 'ugc_script', 'ad'] as const

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const text = typeof body.creative_text === 'string' ? body.creative_text.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : undefined
    const typeHint = VALID_TYPES.includes(body.type_hint) ? body.type_hint : undefined

    if (!text) return NextResponse.json({ error: 'creative_text requerido' }, { status: 400 })

    return streamCritique({ userId: auth.user.id, campaignId, creative_text: text, type_hint: typeHint })
  } catch (err) {
    return handleApiError(err, '/creative/critic')
  }
}
