import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDashboardFromDB, getExecutiveFromDB } from '@/lib/db/queries'
import { handleApiError } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'executive') {
      const summary = await getExecutiveFromDB(auth.user.id)
      return NextResponse.json(summary)
    }

    const summary = await getDashboardFromDB(auth.user.id)
    return NextResponse.json(summary)
  } catch (error) {
    return handleApiError(error, '/insights')
  }
}
