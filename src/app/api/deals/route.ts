import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, withTransaction } from '@/lib/db'
import { lockBatchStock } from '@/lib/stock'
import { dateStr, escapeLike, parseLimit, zodDetails } from '@/lib/validation'
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
  delivery_deadline:    dateStr.nullable().optional(),
  prepayment_date:      dateStr.nullable().optional(),
  actual_delivery_date: dateStr.nullable().optional(),
  actual_payment_date:  dateStr.nullable().optional(),
  upd_number:           z.string().nullable().optional(),
  upd_date:             dateStr.nullable().optional(),
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

  try {
    const { searchParams } = new URL(req.url)
    const search  = searchParams.get('search')?.trim() || ''
    const statusRaw = searchParams.get('status') || 'all'
    const status  = ['all','new','confirmed','shipped','done','cancelled'].includes(statusRaw) ? statusRaw : 'all'
    const overdue = searchParams.get('overdue') === '1'
    const limit   = parseLimit(searchParams.get('limit'), 100, 200)

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
      params.push(`%${escapeLike(search)}%`)
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
  } catch (err) {
    console.error('GET /api/deals error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = dealSchema.parse(body)

    const result = await withTransaction(async (c) => {
      // Блокируем партию и считаем остаток в одной транзакции (нет гонки)
      const stock = await lockBatchStock(c, data.batch_id)
      if (!stock) return { error: 'Партия не найдена', status: 404 as const }
      if (stock.product_id !== data.product_id) {
        return { error: 'Партия относится к другому товару', status: 400 as const }
      }
      if (data.status !== 'cancelled' && stock.balance < data.quantity) {
        return { error: `Недостаточно остатка в партии. Доступно: ${stock.balance} шт.`, status: 409 as const }
      }

      const dup = await c.query('SELECT 1 FROM deals WHERE deal_number = $1', [data.deal_number])
      if (dup.rows[0]) {
        return { error: `Сделка ${data.deal_number} уже существует`, status: 409 as const }
      }

      const ins = await c.query<Deal>(`
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
      return { deal: ins.rows[0] }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const deal = result.deal

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные', details: zodDetails(err) }, { status: 400 })
    }
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Такая сделка уже существует' }, { status: 409 })
    }
    console.error('POST /api/deals error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
