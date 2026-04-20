import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'AdPilot',
    version: 'MVP 1.0',
    services: {
      auth: 'supabase',
      ai_chat: process.env.OPENROUTER_API_KEY ? 'connected (OpenRouter)' : 'missing',
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
    },
  })
}
