import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { approveAction } from '@/lib/action-executor'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const { actionId } = await req.json()
  if (!actionId) return NextResponse.json({ ok: false, error: 'actionId required' }, { status: 400 })

  const result = await approveAction(auth.user.id, actionId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
