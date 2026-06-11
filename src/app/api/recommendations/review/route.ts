import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { markRecommendationReviewed } from '@/features/recommendations/services/recommendations-service'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : null
    const reviewed = body.reviewed === false ? false : true
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 })
    }
    const result = await markRecommendationReviewed(auth.user.id, id, reviewed)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, '/recommendations/review')
  }
}
