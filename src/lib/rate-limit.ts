// Простое ограничение попыток в памяти процесса (достаточно для одного инстанса PM2).
// Для нескольких инстансов нужен общий стор (Redis / таблица в БД).
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function checkLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  if (buckets.size > 10000) {
    buckets.forEach((v, k) => { if (v.resetAt <= now) buckets.delete(k) })
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) return { ok: true, retryAfterSec: 0 }
  return b.count >= max
    ? { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
    : { ok: true, retryAfterSec: 0 }
}

export function registerFailure(key: string, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs })
  else b.count++
}

export function clearFailures(key: string) {
  buckets.delete(key)
}
