import type { PoolClient } from 'pg'

export interface BatchStock {
  product_id: string
  quantity: number
  sold: number
  balance: number
}

// Блокирует строку партии (FOR UPDATE) и считает остаток по не отменённым сделкам.
// Вызывать ТОЛЬКО внутри withTransaction. excludeDealId нужен при правке сделки.
export async function lockBatchStock(
  c: PoolClient,
  batchId: string,
  excludeDealId?: string
): Promise<BatchStock | null> {
  const b = await c.query<{ product_id: string; quantity: number }>(
    'SELECT product_id, quantity FROM batches WHERE id = $1 FOR UPDATE',
    [batchId]
  )
  if (!b.rows[0]) return null

  const s = await c.query<{ sold: string }>(
    `SELECT COALESCE(SUM(quantity), 0) AS sold
     FROM deals
     WHERE batch_id = $1 AND status != 'cancelled' AND ($2::uuid IS NULL OR id != $2::uuid)`,
    [batchId, excludeDealId ?? null]
  )
  const quantity = Number(b.rows[0].quantity)
  const sold = Number(s.rows[0].sold)
  return { product_id: b.rows[0].product_id, quantity, sold, balance: quantity - sold }
}

// Допустимые переходы статусов сделки
const TRANSITIONS: Record<string, string[]> = {
  new:       ['new', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'new', 'shipped', 'cancelled'],
  shipped:   ['shipped', 'confirmed', 'done', 'cancelled'],
  done:      ['done'],
  cancelled: ['cancelled', 'new'],
}

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to)
}
