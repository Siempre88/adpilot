import { NextResponse } from 'next/server'
import { getAuthUser, getMetaConnection } from '@/lib/auth'
import { fullSync, checkSyncRateLimit } from '@/lib/sync-service'

export async function POST() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const connection = await getMetaConnection(auth.user.id)
  if (!connection) {
    return NextResponse.json({ ok: false, error: 'No hay cuenta de Meta conectada' }, { status: 400 })
  }

  // Rate limit
  const rateCheck = await checkSyncRateLimit(auth.user.id)
  if (!rateCheck.allowed) {
    return NextResponse.json({
      ok: false,
      error: `Espera ${rateCheck.waitSeconds} segundos antes de sincronizar de nuevo`,
    }, { status: 429 })
  }

  const result = await fullSync(auth.user.id, connection.access_token, connection.ad_account_id)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
