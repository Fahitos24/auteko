import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME, verifyToken } from '@/lib/jwt'

// Маршруты которые не требуют авторизации
const PUBLIC_PATHS = ['/login', '/api/auth/login']
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// CSRF: изменяющие запросы к API только с нашего Origin
function csrfBlocked(request: NextRequest): boolean {
  if (!MUTATING.has(request.method)) return false
  if (!request.nextUrl.pathname.startsWith('/api/')) return false

  const origin = request.headers.get('origin')
  const allowed = new Set<string>([request.nextUrl.origin])
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try { allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin) } catch { /* ignore */ }
  }
  // Браузер всегда шлёт Origin на POST/PUT/DELETE; нет заголовка или чужой = блок
  if (!origin || !allowed.has(origin)) return true

  // multipart нужен для импорта Excel, остальное только JSON
  const ct = request.headers.get('content-type') || ''
  const hasBody = request.headers.get('content-length') !== '0' && request.method !== 'DELETE'
  if (hasBody && ct && !ct.startsWith('application/json') && !ct.startsWith('multipart/form-data')) return true

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (csrfBlocked(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Пропускаем публичные маршруты
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isApi = pathname.startsWith('/api/')
  const token = request.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verifyToken(token) : null

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const response = NextResponse.redirect(new URL('/login', request.url))
    if (token) response.cookies.delete(COOKIE_NAME)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)',
  ],
}
