import { NextResponse } from 'next/server'
import { getAuthUser, getMetaConnection } from '@/lib/auth'
import { setRequestCredentials } from '@/lib/meta/client'

/**
 * Authenticate user AND load their Meta credentials.
 * Call at the top of every API route that needs Meta data.
 */
export async function withMetaAuth() {
  const auth = await getAuthUser()
  if ('error' in auth) return { error: auth.error }

  const connection = await getMetaConnection(auth.user.id)
  if (!connection) {
    return {
      error: NextResponse.json(
        { ok: false, error_type: 'meta_auth', error_status: 'missing', error: 'No hay cuenta de Meta conectada' },
        { status: 400 }
      ),
    }
  }

  if (connection.token_status === 'expired') {
    return {
      error: NextResponse.json(
        { ok: false, error_type: 'meta_auth', error_status: 'expired', error: 'Tu token de Meta expiró. Actualízalo en Configuración.' },
        { status: 401 }
      ),
    }
  }

  // Set credentials for this request
  setRequestCredentials(connection.access_token, connection.ad_account_id)

  return { user: auth.user, connection }
}
