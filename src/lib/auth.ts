import { cookies } from 'next/headers'
import { COOKIE_NAME, SESSION_HOURS, signToken, verifyToken } from './jwt'
import type { SessionPayload } from './jwt'

export type { SessionPayload }

// Создать JWT и записать в cookie
export async function createSession(payload: SessionPayload) {
  const token = await signToken(payload)

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * SESSION_HOURS,
    path: '/',
  })
}

// Прочитать и верифицировать сессию из cookie
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// Удалить сессию (выход)
export async function deleteSession() {
  cookies().delete(COOKIE_NAME)
}
