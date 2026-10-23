import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'auteko_session'
const EXPIRES_IN = '7d'

export interface SessionPayload {
  userId: string
  email: string
}

// Создать JWT и записать в cookie
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(EXPIRES_IN)
    .setIssuedAt()
    .sign(SECRET)

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    path: '/',
  })
}

// Прочитать и верифицировать сессию из cookie
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// Удалить сессию (выход)
export async function deleteSession() {
  cookies().delete(COOKIE_NAME)
}
