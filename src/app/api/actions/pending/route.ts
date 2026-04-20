import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data } = await supabase
    .from('action_queue')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('impact_value', { ascending: false })

  return NextResponse.json({ ok: true, actions: data || [] })
}
