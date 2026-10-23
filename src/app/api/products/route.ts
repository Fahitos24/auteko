import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Product } from '@/types'

const productSchema = z.object({
  auteko_article:      z.string().min(1).max(100),
  original_articles:   z.array(z.string()).default([]),
  name:                z.string().min(1).max(500),
  engine_models:       z.array(z.string()).default([]),
  tnved_code:          z.string().max(10).nullable().optional(),
  production_days_min: z.number().int().positive().nullable().optional(),
  production_days_max: z.number().int().positive().nullable().optional(),
  is_available:        z.boolean().default(true),
  notes:               z.string().nullable().optional(),
  status:              z.enum(['active', 'archived']).default('active'),
})

// GET /api/products — список товаров
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get('search')?.trim() || ''
  const engine  = searchParams.get('engine') || ''
  const status  = searchParams.get('status') || 'active'
  const page    = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit   = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const offset  = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (status !== 'all') {
    conditions.push(`p.status = $${p++}`)
    params.push(status)
  }

  if (search) {
    conditions.push(`(
      p.auteko_article ILIKE $${p} OR
      p.name ILIKE $${p} OR
      EXISTS (
        SELECT 1 FROM unnest(p.original_articles) art
        WHERE art ILIKE $${p}
      )
    )`)
    params.push(`%${search}%`)
    p++
  }

  if (engine && engine !== 'all') {
    conditions.push(`(
      $${p} = ANY(p.engine_models) OR
      'все' = ANY(p.engine_models)
    )`)
    params.push(engine)
    p++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [products, countRow] = await Promise.all([
    query<Product>(`
      SELECT * FROM products p
      ${where}
      ORDER BY p.name ASC
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, limit, offset]),
    queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM products p ${where}
    `, params),
  ])

  return NextResponse.json({
    data: products,
    total: parseInt(countRow?.count || '0'),
    page,
    limit,
  })
}

// POST /api/products — создать товар
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = productSchema.parse(body)

    // Проверяем уникальность артикула
    const existing = await queryOne(
      'SELECT id FROM products WHERE auteko_article = $1',
      [data.auteko_article]
    )
    if (existing) {
      return NextResponse.json(
        { error: `Артикул ${data.auteko_article} уже существует` },
        { status: 409 }
      )
    }

    const [product] = await query<Product>(`
      INSERT INTO products (
        auteko_article, original_articles, name, engine_models,
        tnved_code, production_days_min, production_days_max,
        is_available, notes, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      data.auteko_article,
      data.original_articles,
      data.name,
      data.engine_models,
      data.tnved_code ?? null,
      data.production_days_min ?? null,
      data.production_days_max ?? null,
      data.is_available,
      data.notes ?? null,
      data.status,
    ])

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные', details: err.errors }, { status: 400 })
    }
    console.error('POST /api/products error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
