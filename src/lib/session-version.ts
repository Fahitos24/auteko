import { queryOne, query } from './db'

// Отзыв сессий через users.token_version / users.is_active (см. db/migrations/001_security.sql).
// Если миграция ещё не применена (колонок нет, код 42703), работаем как раньше и пишем предупреждение.
let columnsMissing = false

function isMissingColumn(e: unknown): boolean {
  return (e as { code?: string })?.code === '42703'
}

function warnOnce() {
  if (!columnsMissing) {
    columnsMissing = true
    console.warn('users.token_version / is_active не найдены: отзыв сессий отключён. Примените db/migrations/001_security.sql')
  }
}

export async function getUserAuthState(userId: string): Promise<{ exists: boolean; tv: number; active: boolean }> {
  if (!columnsMissing) {
    try {
      const row = await queryOne<{ token_version: number; is_active: boolean }>(
        'SELECT token_version, is_active FROM users WHERE id = $1', [userId]
      )
      return row ? { exists: true, tv: Number(row.token_version), active: row.is_active } : { exists: false, tv: 0, active: false }
    } catch (e) {
      if (!isMissingColumn(e)) throw e
      warnOnce()
    }
  }
  const row = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId])
  return { exists: !!row, tv: 0, active: !!row }
}

export async function revokeUserTokens(userId: string): Promise<void> {
  if (columnsMissing) return
  try {
    await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId])
  } catch (e) {
    if (!isMissingColumn(e)) throw e
    warnOnce()
  }
}
