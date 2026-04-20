import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, onboarding_done, created_at')
    .eq('id', auth.user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, profile })
}
