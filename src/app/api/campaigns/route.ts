import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCampaignsFromDB } from '@/lib/scoring/db-read'
import { handleApiError } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const campaigns = await getCampaignsFromDB(auth.user.id)
    return NextResponse.json({ ok: true, campaigns })
  } catch (error) {
    return handleApiError(error, '/campaigns')
  }
}
