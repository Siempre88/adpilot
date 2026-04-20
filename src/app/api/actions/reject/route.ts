import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { rejectAction } from '@/lib/action-executor'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const { actionId, reason } = await req.json()
  if (!actionId) return NextResponse.json({ ok: false, error: 'actionId required' }, { status: 400 })

  const result = await rejectAction(auth.user.id, actionId, reason)
  return NextResponse.json(result)
}
