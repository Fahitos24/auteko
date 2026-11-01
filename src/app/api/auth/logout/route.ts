import { NextResponse } from 'next/server'
import { deleteSession, getSession } from '@/lib/auth'
import { revokeUserTokens } from '@/lib/session-version'

export async function POST() {
  // Увеличиваем token_version: выданные ранее токены перестают работать
  const session = await getSession()
  if (session) await revokeUserTokens(session.userId)
  await deleteSession()
  return NextResponse.json({ ok: true })
}
