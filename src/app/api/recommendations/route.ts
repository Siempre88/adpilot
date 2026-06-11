import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { getRecommendationsData } from '@/features/recommendations/services/recommendations-service'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const data = await getRecommendationsData(auth.user.id)
    return NextResponse.json(data)
  } catch (err) {
    return handleApiError(err, '/recommendations')
  }
}
