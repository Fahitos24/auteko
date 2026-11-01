import { cookies } from 'next/headers'
import { COOKIE_NAME, SESSION_HOURS, signToken, verifyToken } from './jwt'
import type { SessionPayload } from './jwt'
import { getUserAuthState } from './session-version'

export type { SessionPayload }

// Создать JWT и записать в cookie
export async function createSession(payload: SessionPayload) {
  const state = await getUserAuthState(payload.userId)
  const token = await signToken({ ...payload, tv: state.tv })

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
  const session = await verifyToken(token)
  if (!session) return null

  // Сверка с БД: пользователь существует, активен, версия токена актуальна
  const state = await getUserAuthState(session.userId)
  if (!state.exists || !state.active || state.tv !== (session.tv ?? 0)) return null
  return session
}

// Удалить сессию (выход)
export async function deleteSession() {
  cookies().delete(COOKIE_NAME)
}
