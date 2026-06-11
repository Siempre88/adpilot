import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { getTodayData } from '@/features/today/services/today-service'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const data = await getTodayData(auth.user.id)
    return NextResponse.json(data)
  } catch (err) {
    return handleApiError(err, '/today')
  }
}
