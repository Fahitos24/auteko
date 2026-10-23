import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Product } from '@/types'

const updateSchema = z.object({
  auteko_article:      z.string().min(1).max(100).optional(),
  original_articles:   z.array(z.string()).optional(),
  name:                z.string().min(1).max(500).optional(),
  engine_models:       z.array(z.string()).optional(),
  tnved_code:          z.string().max(10).nullable().optional(),
  production_days_min: z.number().int().positive().nullable().optional(),
  production_days_max: z.number().int().positive().nullable().optional(),
  is_available:        z.boolean().optional(),
  notes:               z.string().nullable().optional(),
  status:              z.enum(['active', 'archived']).optional(),
})

// GET /api/products/:id
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await queryOne<Product>(
    'SELECT * FROM products WHERE id = $1',
    [params.id]
  )
  if (!product) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  return NextResponse.json({ data: product })
}

// PUT /api/products/:id
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
      auteko_article:      data.auteko_article,
      original_articles:   data.original_articles,
      name:                data.name,
      engine_models:       data.engine_models,
      tnved_code:          data.tnved_code,
      production_days_min: data.production_days_min,
      production_days_max: data.production_days_max,
      is_available:        data.is_available,
      notes:               data.notes,
      status:              data.status,
    }

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${key} = $${p++}`)
        values.push(val)
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
    }

    values.push(params.id)

    const [product] = await query<Product>(`
      UPDATE products SET ${fields.join(', ')}
      WHERE id = $${p}
      RETURNING *
    `, values)

    if (!product) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

    return NextResponse.json({ data: product })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('PUT /api/products/:id error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE /api/products/:id — архивируем, не удаляем физически
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Проверяем нет ли связанных партий
  const hasBatches = await queryOne(
    'SELECT id FROM batches WHERE product_id = $1 LIMIT 1',
    [params.id]
  )
  if (hasBatches) {
    return NextResponse.json(
      { error: 'Нельзя удалить товар с партиями. Переведите в архив.' },
      { status: 409 }
    )
  }

  await query('UPDATE products SET status = $1 WHERE id = $2', ['archived', params.id])
  return NextResponse.json({ ok: true })
}
