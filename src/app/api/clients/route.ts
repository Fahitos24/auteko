import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Client } from '@/types'

const clientSchema = z.object({
  company_name:   z.string().min(1).max(500),
  inn:            z.string().max(20).nullable().optional(),
  contact_person: z.string().max(255).nullable().optional(),
  phone:          z.string().max(50).nullable().optional(),
  email:          z.string().email().nullable().optional().or(z.literal('')),
  notes:          z.string().nullable().optional(),
})

// GET /api/clients
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || ''
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '100'))

  const conditions: string[] = []
  const params: unknown[]    = []
  let p = 1

  if (search) {
    conditions.push(`(
      c.company_name   ILIKE $${p} OR
      c.inn            ILIKE $${p} OR
      c.contact_person ILIKE $${p} OR
      c.phone          ILIKE $${p}
    )`)
    params.push(`%${search}%`)
    p++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [clients, countRow] = await Promise.all([
    query<Client & { deals_count: string }>(`
      SELECT
        c.*,
        COUNT(d.id) AS deals_count
      FROM clients c
      LEFT JOIN deals d ON d.client_id = c.id AND d.status != 'cancelled'
      ${where}
      GROUP BY c.id
      ORDER BY c.company_name ASC
      LIMIT $${p}
    `, [...params, limit]),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM clients c ${where}`,
      params
    ),
  ])

  return NextResponse.json({
    data:  clients,
    total: parseInt(countRow?.count || '0'),
  })
}

// POST /api/clients
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = clientSchema.parse(body)

    const [client] = await query<Client>(`
      INSERT INTO clients (company_name, inn, contact_person, phone, email, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      data.company_name,
      data.inn            || null,
      data.contact_person || null,
      data.phone          || null,
      data.email          || null,
      data.notes          || null,
    ])

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    console.error('POST /api/clients error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
