import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAlertsFromDB } from '@/lib/db-queries'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const alerts = await getAlertsFromDB(auth.user.id)
    return NextResponse.json({ ok: true, alerts })
  } catch (error) {
    return handleApiError(error, '/alerts')
  }
}
