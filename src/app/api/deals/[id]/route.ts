import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, withTransaction } from '@/lib/db'
import { canTransition, lockBatchStock } from '@/lib/stock'
import { badId, dateStr } from '@/lib/validation'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Deal } from '@/types'

const updateSchema = z.object({
  contract_number:      z.string().nullable().optional(),
  spec_number:          z.string().nullable().optional(),
  quantity:             z.number().int().positive().optional(),
  price_with_vat:       z.number().positive().optional(),
  delivery_deadline:    dateStr.nullable().optional(),
  prepayment_date:      dateStr.nullable().optional(),
  actual_delivery_date: dateStr.nullable().optional(),
  actual_payment_date:  dateStr.nullable().optional(),
  upd_number:           z.string().nullable().optional(),
  upd_date:             dateStr.nullable().optional(),
  status:               z.enum(['new','confirmed','shipped','done','cancelled']).optional(),
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

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const bad = badId(params.id); if (bad) return bad }

  try {
    const deal = await queryOne<Deal>(`${DEAL_SELECT} WHERE d.id = $1`, [params.id])
    if (!deal) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ data: deal })
  } catch (err) {
    console.error('GET /api/deals/:id error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const bad = badId(params.id); if (bad) return bad }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const fields: string[] = []
    const values: unknown[] = []
    let p = 1

    const map: Record<string, unknown> = {
      contract_number:      data.contract_number,
      spec_number:          data.spec_number,
      quantity:             data.quantity,
      price_with_vat:       data.price_with_vat,
      delivery_deadline:    data.delivery_deadline,
      prepayment_date:      data.prepayment_date,
      actual_delivery_date: data.actual_delivery_date,
      actual_payment_date:  data.actual_payment_date,
      upd_number:           data.upd_number,
      upd_date:             data.upd_date,
      status:               data.status,
      notes:                data.notes,
    }

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${key} = $${p++}`)
        values.push(val)
      }
    }

    if (!fields.length) return NextResponse.json({ error: 'Нет данных' }, { status: 400 })

    values.push(params.id)
    const result = await withTransaction(async (c) => {
      const cur = await c.query<{ status: string; quantity: number; batch_id: string }>(
        'SELECT status, quantity, batch_id FROM deals WHERE id = $1 FOR UPDATE', [params.id]
      )
      const row = cur.rows[0]
      if (!row) return { notFound: true as const }

      const nextStatus = data.status ?? row.status
      const nextQty = data.quantity ?? Number(row.quantity)

      if (!canTransition(row.status, nextStatus)) {
        return { error: `Переход статуса ${row.status} → ${nextStatus} недопустим`, code: 409 }
      }
      if (row.status === 'done' && data.quantity !== undefined && data.quantity !== Number(row.quantity)) {
        return { error: 'Нельзя менять количество завершённой сделки', code: 409 }
      }

      // Остаток перепроверяем, если сделка станет/остаётся активной
      if (nextStatus !== 'cancelled' && (data.quantity !== undefined || row.status === 'cancelled')) {
        const stock = await lockBatchStock(c, row.batch_id, params.id)
        if (!stock) return { error: 'Партия не найдена', code: 404 }
        if (stock.balance < nextQty) {
          return { error: `Недостаточно остатка в партии. Доступно: ${stock.balance} шт.`, code: 409 }
        }
      }

      const upd = await c.query<Deal>(
        `UPDATE deals SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`, values
      )
      return { deal: upd.rows[0] }
    })

    if ('notFound' in result) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.code })
    const deal = result.deal
    return NextResponse.json({ data: deal })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('PUT /api/deals/:id error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const bad = badId(params.id); if (bad) return bad }

  // Отменяем вместо физического удаления
  const res = await query<{ id: string }>(
    `UPDATE deals SET status = 'cancelled' WHERE id = $1 AND status != 'done' RETURNING id`, [params.id]
  )
  if (!res.length) {
    return NextResponse.json({ error: 'Сделка не найдена или уже завершена' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
