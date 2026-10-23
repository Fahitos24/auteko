import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Batch } from '@/types'

const updateSchema = z.object({
  quantity:           z.number().int().positive().optional(),
  price_exw_cny:      z.number().positive().optional(),
  cny_rate:           z.number().positive().optional(),
  cny_rate_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customs_duty_pct:   z.number().min(0).max(100).optional(),
  transport_cost:     z.number().min(0).optional(),
  other_costs:        z.number().min(0).optional(),
  markup_coefficient: z.number().positive().optional(),
  gtd_number:         z.string().nullable().optional(),
  gtd_date:           z.string().nullable().optional(),
})

// GET /api/batches/:id
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batch = await queryOne<Batch>(`
    SELECT b.*, pr.name AS product_name, pr.auteko_article AS product_article
    FROM batches b
    JOIN products pr ON pr.id = b.product_id
    WHERE b.id = $1
  `, [params.id])

  if (!batch) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json({ data: batch })
}

// PUT /api/batches/:id
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
      quantity:           data.quantity,
      price_exw_cny:      data.price_exw_cny,
      cny_rate:           data.cny_rate,
      cny_rate_date:      data.cny_rate_date,
      customs_duty_pct:   data.customs_duty_pct,
      transport_cost:     data.transport_cost,
      other_costs:        data.other_costs,
      markup_coefficient: data.markup_coefficient,
      gtd_number:         data.gtd_number,
      gtd_date:           data.gtd_date,
    }

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${key} = $${p++}`)
        values.push(val)
      }
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
    }

    values.push(params.id)

    // Триггер пересчитает cost_price_rub, price_kp_rub, profit_per_unit
    const [batch] = await query<Batch>(`
      UPDATE batches SET ${fields.join(', ')}
      WHERE id = $${p}
      RETURNING *
    `, values)

    if (!batch) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ data: batch })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('PUT /api/batches/:id error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE /api/batches/:id
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Проверяем нет ли сделок по этой партии
  const hasDeals = await queryOne(
    `SELECT id FROM deals WHERE batch_id = $1 AND status != 'cancelled' LIMIT 1`,
    [params.id]
  )
  if (hasDeals) {
    return NextResponse.json(
      { error: 'Нельзя удалить партию с активными сделками' },
      { status: 409 }
    )
  }

  await query('DELETE FROM batches WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
