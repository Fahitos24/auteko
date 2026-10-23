import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import type { Client } from '@/types'

const updateSchema = z.object({
  company_name:   z.string().min(1).max(500).optional(),
  inn:            z.string().max(20).nullable().optional(),
  contact_person: z.string().max(255).nullable().optional(),
  phone:          z.string().max(50).nullable().optional(),
  email:          z.string().email().nullable().optional().or(z.literal('')),
  notes:          z.string().nullable().optional(),
})

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await queryOne<Client>(
    'SELECT * FROM clients WHERE id = $1', [params.id]
  )
  if (!client) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  return NextResponse.json({ data: client })
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
      company_name:   data.company_name,
      inn:            data.inn,
      contact_person: data.contact_person,
      phone:          data.phone,
      email:          data.email || null,
      notes:          data.notes,
    }

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${key} = $${p++}`)
        values.push(val)
      }
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'Нет данных' }, { status: 400 })
    }

    values.push(params.id)
    const [client] = await query<Client>(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    )

    if (!client) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json({ data: client })
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

  const hasDeals = await queryOne(
    `SELECT id FROM deals WHERE client_id = $1 AND status != 'cancelled' LIMIT 1`,
    [params.id]
  )
  if (hasDeals) {
    return NextResponse.json(
      { error: 'Нельзя удалить контрагента с активными сделками' },
      { status: 409 }
    )
  }

  await query('DELETE FROM clients WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
