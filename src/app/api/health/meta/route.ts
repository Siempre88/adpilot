import { NextResponse } from 'next/server'
import { validateMetaToken } from '@/lib/meta-ads'

export async function GET() {
  const result = await validateMetaToken()
  return NextResponse.json(result)
}
