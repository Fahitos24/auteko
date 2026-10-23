import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { z } from 'zod'
import type { User } from '@/types'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)

    // Ищем пользователя
    const user = await queryOne<User & { password_hash: string }>(
      'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (!user) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    // Проверяем пароль
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    // Создаём сессию
    await createSession({ userId: user.id, email: user.email })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
