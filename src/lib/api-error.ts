import { NextResponse } from 'next/server'
import { MetaAuthError } from '@/lib/meta/client'

export function handleApiError(error: unknown, context: string) {
  console.error(`[API ${context}]`, error)

  if (error instanceof MetaAuthError) {
    return NextResponse.json({
      ok: false,
      error_type: 'meta_auth',
      error_status: error.status, // 'expired' | 'invalid'
      error: error.status === 'expired'
        ? 'Tu conexión con Meta expiró. Actualiza tu token en .env.local'
        : 'Token de Meta inválido. Genera uno nuevo en developers.facebook.com',
      message: error.message,
    }, { status: 401 })
  }

  return NextResponse.json({
    ok: false,
    error_type: 'server',
    error: error instanceof Error ? error.message : 'Error interno',
  }, { status: 500 })
}
