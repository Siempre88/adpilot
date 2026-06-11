import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import {
  generateCreatives,
  getCreativeLabBootstrap,
  buildDiagnosis,
} from '@/features/creative-lab/services/creative-lab-service'
import type { CreativeAngle } from '@/features/creative-lab/types'

const VALID_ANGLES: CreativeAngle[] = [
  'auto', 'pain', 'benefit', 'social_proof', 'urgency',
  'comparison', 'before_after', 'demonstration',
]

// GET → bootstrap (campaigns priorizadas) o ?campaignId=... → diagnosis
export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')

    if (campaignId) {
      const diagnosis = await buildDiagnosis(auth.user.id, campaignId)
      if (!diagnosis) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
      return NextResponse.json({ state: 'loaded', diagnosis })
    }

    const data = await getCreativeLabBootstrap(auth.user.id)
    return NextResponse.json(data)
  } catch (err) {
    return handleApiError(err, '/creative/generate.get')
  }
}

// POST → genera creativos para una campaña
export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : null
    const angleRaw = typeof body.angle === 'string' ? body.angle : 'auto'
    const angle: CreativeAngle = (VALID_ANGLES.includes(angleRaw as CreativeAngle) ? angleRaw : 'auto') as CreativeAngle

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 })
    }

    const result = await generateCreatives(auth.user.id, campaignId, angle)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err, '/creative/generate.post')
  }
}
