import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { precheckAnalyst, streamAnalystResponse } from '@/features/analyst/services/analyst-service'
import type { ChatMessage } from '@/features/analyst/types'

// GET → empty-state precheck (UI lo consulta al montar)
export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const empty = await precheckAnalyst(auth.user.id)
    if (empty) return NextResponse.json(empty)
    return NextResponse.json({ state: 'ready' })
  } catch (err) {
    return handleApiError(err, '/analyst/precheck')
  }
}

// POST → streaming chat
export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const messages = (body.messages ?? []) as ChatMessage[]
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages requerido' }, { status: 400 })
    }
    return streamAnalystResponse(auth.user.id, messages)
  } catch (err) {
    return handleApiError(err, '/analyst')
  }
}
