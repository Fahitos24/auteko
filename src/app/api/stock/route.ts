import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { StockBalance } from '@/types'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || ''
  const status = searchParams.get('status') || 'all' // all | green | yellow | red

  const conditions: string[] = []
  const params: unknown[]    = []
  let p = 1

  if (search) {
    conditions.push(`(
      s.auteko_article ILIKE $${p} OR
      s.name           ILIKE $${p} OR
      s.batch_number   ILIKE $${p}
    )`)
    params.push(`%${search}%`)
    p++
  }

  if (status !== 'all') {
    conditions.push(`s.stock_status = $${p++}`)
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, countRow, summary] = await Promise.all([
    query<StockBalance>(`
      SELECT * FROM stock_balance s
      ${where}
      ORDER BY s.name ASC, s.batch_number ASC
    `, params),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM stock_balance s ${where}`, params),
    queryOne<{ green: string; yellow: string; red: string; total_value: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE stock_status = 'green')  AS green,
        COUNT(*) FILTER (WHERE stock_status = 'yellow') AS yellow,
        COUNT(*) FILTER (WHERE stock_status = 'red')    AS red,
        SUM(balance * price_kp_rub)                     AS total_value
      FROM stock_balance
    `),
  ])

  return NextResponse.json({
    data:    rows,
    total:   parseInt(countRow?.count || '0'),
    summary: {
      green:       parseInt(summary?.green       || '0'),
      yellow:      parseInt(summary?.yellow      || '0'),
      red:         parseInt(summary?.red         || '0'),
      total_value: Number(summary?.total_value   || 0),
    },
  })
}
