import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Deal } from '@/types'

const updateSchema = z.object({
  contract_number:      z.string().nullable().optional(),
  spec_number:          z.string().nullable().optional(),
  quantity:             z.number().int().positive().optional(),
  price_with_vat:       z.number().positive().optional(),
  delivery_deadline:    z.string().nullable().optional(),
  prepayment_date:      z.string().nullable().optional(),
  actual_delivery_date: z.string().nullable().optional(),
  actual_payment_date:  z.string().nullable().optional(),
  upd_number:           z.string().nullable().optional(),
  upd_date:             z.string().nullable().optional(),
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

  const deal = await queryOne<Deal>(`${DEAL_SELECT} WHERE d.id = $1`, [params.id])
  if (!deal) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json({ data: deal })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const [deal] = await query<Deal>(
      `UPDATE deals SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    )

    if (!deal) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ data: deal })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Отменяем вместо физического удаления
  await query(`UPDATE deals SET status = 'cancelled' WHERE id = $1`, [params.id])
  return NextResponse.json({ ok: true })
}
