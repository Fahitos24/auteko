import { NextResponse } from 'next/server'
import { z } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Возвращает 400-ответ, если id не UUID (иначе Postgres падает с 500)
export function badId(id: string): NextResponse | null {
  return UUID_RE.test(id) ? null : NextResponse.json({ error: 'Некорректный id' }, { status: 400 })
}

// Реальная календарная дата YYYY-MM-DD (отсекает 2026-13-45)
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}, 'Некорректная дата')

// Для ILIKE: экранируем % _ \
export function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, m => `\\${m}`)
}

// Безопасный limit: целое 1..max, иначе значение по умолчанию
export function parseLimit(v: string | null, def = 50, max = 200): number {
  const n = Number.parseInt(v ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(n, max)
}

// Ошибки валидации без деталей схемы в проде
export function zodDetails(err: z.ZodError) {
  if (process.env.NODE_ENV === 'production') {
    return err.errors.map(e => e.path.join('.'))
  }
  return err.errors
}

export function parsePage(v: string | null): number {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1
}
