import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

export interface Settings {
  stock_threshold_yellow: number
  stock_threshold_red:    number
  default_markup:         number
  batch_number_prefix:    string
  batch_number_counter:   number
  deal_number_prefix:     string
  deal_number_counter:    number
  company_name:           string
  company_inn:            string
  company_address:        string
}

const settingsSchema = z.object({
  stock_threshold_yellow: z.number().int().min(0).optional(),
  stock_threshold_red:    z.number().int().min(0).optional(),
  default_markup:         z.number().min(1).optional(),
  batch_number_prefix:    z.string().max(10).optional(),
  batch_number_counter:   z.number().int().min(1).optional(),
  deal_number_prefix:     z.string().max(10).optional(),
  deal_number_counter:    z.number().int().min(1).optional(),
  company_name:           z.string().max(500).optional(),
  company_inn:            z.string().max(20).optional(),
  company_address:        z.string().max(500).optional(),
})

// GET /api/settings — все настройки одним объектом
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query<{ key: string; value: string }>(
    'SELECT key, value FROM settings ORDER BY key'
  )

  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))

  const settings: Settings = {
    stock_threshold_yellow: parseInt(map.stock_threshold_yellow || '5'),
    stock_threshold_red:    parseInt(map.stock_threshold_red    || '1'),
    default_markup:         parseFloat(map.default_markup       || '1.25'),
    batch_number_prefix:    map.batch_number_prefix  || 'P',
    batch_number_counter:   parseInt(map.batch_number_counter   || '1'),
    deal_number_prefix:     map.deal_number_prefix   || 'R',
    deal_number_counter:    parseInt(map.deal_number_counter    || '1'),
    company_name:           map.company_name    || '',
    company_inn:            map.company_inn     || '',
    company_address:        map.company_address || '',
  }

  return NextResponse.json({ data: settings })
}

// PUT /api/settings — обновить настройки
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = settingsSchema.parse(body)

    // Обновляем каждую настройку отдельно
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        await query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, String(val)]
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
