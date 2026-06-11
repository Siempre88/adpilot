import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/db/supabase/server'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

// GET — current connection status from DB
export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data: connection } = await supabase
    .from('meta_connections')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (!connection) {
    return NextResponse.json({ status: 'missing', account_id: null, message: 'No hay cuenta conectada' })
  }

  // Validate token is still active
  try {
    const res = await fetch(`${GRAPH_API}/debug_token?input_token=${connection.access_token}&access_token=${connection.access_token}`)
    const json = await res.json()

    if (json.error || !json.data?.is_valid) {
      // Update status in DB
      await supabase.from('meta_connections').update({ token_status: 'expired' }).eq('id', connection.id)
      return NextResponse.json({ status: 'expired', account_id: connection.ad_account_id, message: 'Token expirado' })
    }

    return NextResponse.json({
      status: 'connected',
      account_id: connection.ad_account_id,
      account_name: connection.account_name,
      expires: json.data.expires_at ? new Date(json.data.expires_at * 1000).toISOString() : null,
      message: 'Conectado correctamente',
    })
  } catch {
    return NextResponse.json({ status: 'invalid', account_id: connection.ad_account_id, message: 'Error al validar' })
  }
}

// POST — connect with new credentials, save to DB
export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { token, accountId } = body

  if (!token || !accountId) {
    return NextResponse.json({ ok: false, status: 'invalid', message: 'Token y Account ID son requeridos' }, { status: 400 })
  }
  if (!accountId.startsWith('act_')) {
    return NextResponse.json({ ok: false, status: 'invalid', message: 'Account ID debe empezar con act_' }, { status: 400 })
  }

  // Validate token
  try {
    const res = await fetch(`${GRAPH_API}/debug_token?input_token=${token}&access_token=${token}`)
    const json = await res.json()

    if (json.error) {
      return NextResponse.json({ ok: false, status: 'invalid', message: `Token inválido: ${json.error.message}` }, { status: 401 })
    }
    if (!json.data?.is_valid) {
      return NextResponse.json({ ok: false, status: 'expired', message: 'Token expirado' }, { status: 401 })
    }

    // Test account access
    const accRes = await fetch(`${GRAPH_API}/${accountId}/campaigns?fields=id&limit=1&access_token=${token}`)
    const accJson = await accRes.json()
    if (accJson.error) {
      return NextResponse.json({ ok: false, status: 'invalid', message: `No se puede acceder a la cuenta: ${accJson.error.message}` }, { status: 403 })
    }

    // Get account name
    let accountName = accountId
    try {
      const nameRes = await fetch(`${GRAPH_API}/${accountId}?fields=name&access_token=${token}`)
      const nameJson = await nameRes.json()
      if (nameJson.name) accountName = nameJson.name
    } catch {}

    // Upsert connection in DB
    const supabase = await createClient()
    const { error: dbError } = await supabase.from('meta_connections').upsert({
      user_id: auth.user.id,
      ad_account_id: accountId,
      access_token: token,
      token_status: 'active',
      account_name: accountName,
      connected_at: new Date().toISOString(),
      expires_at: json.data.expires_at ? new Date(json.data.expires_at * 1000).toISOString() : null,
    }, { onConflict: 'user_id,ad_account_id' })

    if (dbError) {
      console.error('[Settings] DB error:', dbError)
      return NextResponse.json({ ok: false, status: 'invalid', message: 'Error al guardar conexión' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      status: 'connected',
      account_id: accountId,
      account_name: accountName,
      expires: json.data.expires_at ? new Date(json.data.expires_at * 1000).toISOString() : null,
      message: 'Conectado correctamente',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, status: 'invalid', message: 'Error al conectar' }, { status: 500 })
  }
}
