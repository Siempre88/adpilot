import { NextResponse } from 'next/server'
import { validateMetaToken } from '@/lib/meta/client'

export async function GET() {
  const result = await validateMetaToken()
  return NextResponse.json(result)
}
