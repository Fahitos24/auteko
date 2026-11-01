import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { checkLimit, registerFailure, clearFailures } from '@/lib/rate-limit'
import { z } from 'zod'
import type { User } from '@/types'

const loginSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(200),
})

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

// Заранее посчитанный хеш: bcrypt.compare выполняется даже для несуществующего email,
// чтобы время ответа не выдавало, есть ли такой пользователь
const DUMMY_HASH = '$2a$12$54tpYpu5bDaQBuoObMRydORElj.OjwF0PGLZ5ALcT3Y2rS.mbazve'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)
    const emailKey = `login:email:${email.toLowerCase()}`
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
    const ipKey = `login:ip:${ip}`

    // Лимит и по email, и по IP: 5 неудачных попыток за 15 минут
    for (const key of [emailKey, ipKey]) {
      const lim = checkLimit(key, MAX_ATTEMPTS, WINDOW_MS)
      if (!lim.ok) {
        return NextResponse.json(
          { error: 'Слишком много попыток. Попробуйте позже.' },
          { status: 429, headers: { 'Retry-After': String(lim.retryAfterSec) } }
        )
      }
    }

    const user = await queryOne<User & { password_hash: string }>(
      'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH)
    if (!user || !valid) {
      registerFailure(emailKey, WINDOW_MS)
      registerFailure(ipKey, WINDOW_MS)
      console.warn(`Failed login for ${email.toLowerCase()} from ${ip}`)
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    clearFailures(emailKey)
    await createSession({ userId: user.id, email: user.email })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
