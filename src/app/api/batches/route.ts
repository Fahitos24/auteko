import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Batch } from '@/types'

const batchSchema = z.object({
  batch_number:       z.string().min(1).max(50),
  product_id:         z.string().uuid(),
  quantity:           z.number().int().positive(),
  price_exw_cny:      z.number().positive(),
  cny_rate:           z.number().positive(),
  cny_rate_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customs_duty_pct:   z.number().min(0).max(100).default(0),
  transport_cost:     z.number().min(0).default(0),
  other_costs:        z.number().min(0).default(0),
  markup_coefficient: z.number().positive().default(1.25),
  gtd_number:         z.string().nullable().optional(),
  gtd_date:           z.string().nullable().optional(),
})

// GET /api/batches
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search     = searchParams.get('search')?.trim() || ''
  const product_id = searchParams.get('product_id') || ''
  const page       = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit      = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const offset     = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[]    = []
  let p = 1

  if (search) {
    conditions.push(`(b.batch_number ILIKE $${p} OR pr.auteko_article ILIKE $${p} OR pr.name ILIKE $${p})`)
    params.push(`%${search}%`)
    p++
  }

  if (product_id) {
    conditions.push(`b.product_id = $${p++}`)
    params.push(product_id)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [batches, countRow] = await Promise.all([
    query<Batch>(`
      SELECT
        b.*,
        pr.name            AS product_name,
        pr.auteko_article  AS product_article
      FROM batches b
      JOIN products pr ON pr.id = b.product_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, limit, offset]),
    queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM batches b
      JOIN products pr ON pr.id = b.product_id
      ${where}
    `, params),
  ])

  return NextResponse.json({
    data:  batches,
    total: parseInt(countRow?.count || '0'),
    page,
    limit,
  })
}

// POST /api/batches
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = batchSchema.parse(body)

    // Проверяем уникальность номера партии
    const existing = await queryOne(
      'SELECT id FROM batches WHERE batch_number = $1',
      [data.batch_number]
    )
    if (existing) {
      return NextResponse.json(
        { error: `Партия ${data.batch_number} уже существует` },
        { status: 409 }
      )
    }

    // Проверяем что товар существует
    const product = await queryOne(
      'SELECT id FROM products WHERE id = $1',
      [data.product_id]
    )
    if (!product) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })
    }

    // Себестоимость считается триггером в БД автоматически
    const [batch] = await query<Batch>(`
      INSERT INTO batches (
        batch_number, product_id, quantity,
        price_exw_cny, cny_rate, cny_rate_date,
        customs_duty_pct, transport_cost, other_costs,
        markup_coefficient, gtd_number, gtd_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      data.batch_number,
      data.product_id,
      data.quantity,
      data.price_exw_cny,
      data.cny_rate,
      data.cny_rate_date,
      data.customs_duty_pct,
      data.transport_cost,
      data.other_costs,
      data.markup_coefficient,
      data.gtd_number ?? null,
      data.gtd_date   ?? null,
    ])

    return NextResponse.json({ data: batch }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные', details: err.errors }, { status: 400 })
    }
    console.error('POST /api/batches error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
