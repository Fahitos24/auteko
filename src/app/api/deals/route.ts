import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Deal } from '@/types'

const dealSchema = z.object({
  deal_number:          z.string().min(1).max(50),
  client_id:            z.string().uuid(),
  product_id:           z.string().uuid(),
  batch_id:             z.string().uuid(),
  contract_number:      z.string().nullable().optional(),
  spec_number:          z.string().nullable().optional(),
  quantity:             z.number().int().positive(),
  price_with_vat:       z.number().positive(),
  delivery_deadline:    z.string().nullable().optional(),
  prepayment_date:      z.string().nullable().optional(),
  actual_delivery_date: z.string().nullable().optional(),
  actual_payment_date:  z.string().nullable().optional(),
  upd_number:           z.string().nullable().optional(),
  upd_date:             z.string().nullable().optional(),
  status:               z.enum(['new','confirmed','shipped','done','cancelled']).default('new'),
  notes:                z.string().nullable().optional(),
})

const DEAL_SELECT = `
  SELECT
    d.*,
    c.company_name          AS client_name,
    pr.name                 AS product_name,
    pr.auteko_article       AS product_article,
    b.batch_number,
    b.cost_price_rub,
    b.price_kp_rub,
    (d.price_with_vat - b.cost_price_rub) * d.quantity AS total_profit
  FROM deals d
  JOIN clients  c  ON c.id  = d.client_id
  JOIN products pr ON pr.id = d.product_id
  JOIN batches  b  ON b.id  = d.batch_id
`

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get('search')?.trim() || ''
  const status  = searchParams.get('status') || 'all'
  const overdue = searchParams.get('overdue') === '1'
  const limit   = Math.min(200, parseInt(searchParams.get('limit') || '100'))

  const conditions: string[] = []
  const params: unknown[]    = []
  let p = 1

  if (search) {
    conditions.push(`(
      d.deal_number     ILIKE $${p} OR
      c.company_name    ILIKE $${p} OR
      pr.auteko_article ILIKE $${p} OR
      pr.name           ILIKE $${p} OR
      d.contract_number ILIKE $${p}
    )`)
    params.push(`%${search}%`)
    p++
  }

  if (status !== 'all') {
    conditions.push(`d.status = $${p++}`)
    params.push(status)
  }

  if (overdue) {
    conditions.push(`d.delivery_deadline < CURRENT_DATE AND d.status NOT IN ('done','cancelled')`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [deals, countRow] = await Promise.all([
    query<Deal>(`${DEAL_SELECT} ${where} ORDER BY d.created_at DESC LIMIT $${p}`, [...params, limit]),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM deals d JOIN clients c ON c.id = d.client_id JOIN products pr ON pr.id = d.product_id JOIN batches b ON b.id = d.batch_id ${where}`, params),
  ])

  // Считаем кол-во просроченных отдельно
  const overdueCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM deals WHERE delivery_deadline < CURRENT_DATE AND status NOT IN ('done','cancelled')`
  )

  return NextResponse.json({
    data:          deals,
    total:         parseInt(countRow?.count || '0'),
    overdue_count: parseInt(overdueCount?.count || '0'),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = dealSchema.parse(body)

    const existing = await queryOne('SELECT id FROM deals WHERE deal_number = $1', [data.deal_number])
    if (existing) {
      return NextResponse.json({ error: `Сделка ${data.deal_number} уже существует` }, { status: 409 })
    }

    // Проверяем что в партии достаточно остатка
    const stock = await queryOne<{ balance: number }>(`
      SELECT
        b.quantity - COALESCE(SUM(CASE WHEN d2.status != 'cancelled' THEN d2.quantity ELSE 0 END), 0) AS balance
      FROM batches b
      LEFT JOIN deals d2 ON d2.batch_id = b.id
      WHERE b.id = $1
      GROUP BY b.quantity
    `, [data.batch_id])

    if (stock && Number(stock.balance) < data.quantity) {
      return NextResponse.json(
        { error: `Недостаточно остатка в партии. Доступно: ${stock.balance} шт.` },
        { status: 409 }
      )
    }

    const [deal] = await query<Deal>(`
      INSERT INTO deals (
        deal_number, client_id, product_id, batch_id,
        contract_number, spec_number, quantity, price_with_vat,
        delivery_deadline, prepayment_date,
        actual_delivery_date, actual_payment_date,
        upd_number, upd_date, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      data.deal_number, data.client_id, data.product_id, data.batch_id,
      data.contract_number || null, data.spec_number || null,
      data.quantity, data.price_with_vat,
      data.delivery_deadline    || null, data.prepayment_date      || null,
      data.actual_delivery_date || null, data.actual_payment_date  || null,
      data.upd_number || null, data.upd_date || null,
      data.status, data.notes || null,
    ])

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные', details: err.errors }, { status: 400 })
    }
    console.error('POST /api/deals error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
