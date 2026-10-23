import { Pool } from 'pg'

// Пул соединений с PostgreSQL
// Один пул на всё приложение (Next.js переиспользует между запросами)
const globalForDb = globalThis as unknown as { db: Pool }

export const db = globalForDb.db ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,               // максимум соединений в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}

// Хелпер для одного запроса
export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await db.query(sql, params)
  return rows as T[]
}

// Хелпер для одной строки
export async function queryOne<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
