import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data } = await supabase
    .from('action_log')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('executed_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ok: true, log: data || [] })
}
