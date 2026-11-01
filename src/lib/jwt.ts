import { SignJWT, jwtVerify } from 'jose'

export const COOKIE_NAME = 'auteko_session'
export const SESSION_HOURS = 12
const ISSUER = 'auteko'
const AUDIENCE = 'auteko-app'

export interface SessionPayload {
  userId: string
  email: string
}

// Секрет читается лениво (не при импорте), чтобы `next build` не падал без env.
// Но при первом реальном использовании слабый секрет = ошибка.
function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32 || raw === 'your_super_secret_key_here') {
    throw new Error('JWT_SECRET не задан, короче 32 символов или равен значению из .env.example')
  }
  return new TextEncoder().encode(raw)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null
    return { userId: payload.userId, email: payload.email }
  } catch {
    return null
  }
}
