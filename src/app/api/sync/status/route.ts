import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSyncStatus } from '@/lib/sync-service'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const status = await getSyncStatus(auth.user.id)
  return NextResponse.json(status)
}
