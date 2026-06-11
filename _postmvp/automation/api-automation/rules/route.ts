import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const supabase = await createClient()
  const { data } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('priority', { ascending: true })

  return NextResponse.json({ ok: true, rules: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const supabase = await createClient()

  if (body.id) {
    // Update existing
    const { error } = await supabase.from('automation_rules').update({
      name: body.name,
      is_active: body.is_active,
      priority: body.priority,
      trigger_type: body.trigger_type,
      trigger_operator: body.trigger_operator,
      trigger_value: body.trigger_value,
      action_type: body.action_type,
      action_params: body.action_params || {},
      requires_approval: body.requires_approval ?? true,
    }).eq('id', body.id).eq('user_id', auth.user.id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  } else {
    // Create new
    const { error } = await supabase.from('automation_rules').insert({
      user_id: auth.user.id,
      name: body.name,
      priority: body.priority || 100,
      trigger_type: body.trigger_type,
      trigger_operator: body.trigger_operator || '>',
      trigger_value: body.trigger_value,
      action_type: body.action_type,
      action_params: body.action_params || {},
      requires_approval: body.requires_approval ?? true,
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
