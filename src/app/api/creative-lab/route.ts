import { NextRequest, NextResponse } from 'next/server'
import { getCreativeInsights, generateCreative, generateCreativeForWorst } from '@/lib/creative-lab'
import { withMetaAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await withMetaAuth()
  if ('error' in auth) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'insights'
    const campaignId = searchParams.get('campaignId')
    const datePreset = searchParams.get('preset') || 'last_7d'

    if (action === 'insights') {
      const insights = await getCreativeInsights(datePreset)
      return NextResponse.json({ ok: true, insights })
    }

    if (action === 'generate' && campaignId) {
      const creative = await generateCreative(campaignId, datePreset)
      return NextResponse.json({ ok: true, creative })
    }

    if (action === 'generate-worst') {
      const creatives = await generateCreativeForWorst(datePreset)
      return NextResponse.json({ ok: true, creatives })
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API /creative-lab]', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Error in Creative Lab' }, { status: 500 })
  }
}
