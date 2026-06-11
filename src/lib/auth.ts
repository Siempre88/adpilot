import { createClient } from '@/lib/db/supabase/server'
import { NextResponse } from 'next/server'

export interface AuthUser {
  id: string
  email: string
}

/**
 * Get authenticated user from request. Returns user or error response.
 * Use at the top of every API route.
 */
export async function getAuthUser(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: NextResponse.json(
        { ok: false, error_type: 'auth', error: 'No autenticado' },
        { status: 401 }
      ),
    }
  }

  return { user: { id: user.id, email: user.email || '' } }
}

/**
 * Get Meta connection (token + account) for a user.
 * Returns null if no connection exists.
 */
export async function getMetaConnection(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meta_connections')
    .select('*')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as {
    id: string
    user_id: string
    ad_account_id: string
    access_token: string
    token_status: string
    account_name: string | null
    connected_at: string
    expires_at: string | null
  }
}
