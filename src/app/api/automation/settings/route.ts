import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data } = await supabase.from('automation_settings').select('*').eq('user_id', auth.user.id).single()

  return NextResponse.json({ ok: true, settings: data || null })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const supabase = await createClient()

  const { error } = await supabase.from('automation_settings').upsert({
    user_id: auth.user.id,
    automation_enabled: body.automation_enabled ?? false,
    auto_pause_enabled: body.auto_pause_enabled ?? false,
    auto_pause_threshold: body.auto_pause_threshold ?? 30,
    auto_scale_enabled: body.auto_scale_enabled ?? false,
    auto_scale_max_increase: body.auto_scale_max_increase ?? 25,
    budget_limit_daily: body.budget_limit_daily ?? 100,
    approval_required: body.approval_required ?? true,
    cool_down_minutes: body.cool_down_minutes ?? 60,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
