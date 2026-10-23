import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/settings/next-number?type=batch|deal
// Возвращает следующий номер БЕЗ инкремента (только предпросмотр)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type')
  if (type !== 'batch' && type !== 'deal') {
    return NextResponse.json({ error: 'type must be batch or deal' }, { status: 400 })
  }

  const prefixKey  = type === 'batch' ? 'batch_number_prefix'  : 'deal_number_prefix'
  const counterKey = type === 'batch' ? 'batch_number_counter' : 'deal_number_counter'

  const [prefixRow, counterRow] = await Promise.all([
    queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [prefixKey]),
    queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [counterKey]),
  ])

  const prefix  = prefixRow?.value  || (type === 'batch' ? 'P' : 'R')
  const counter = parseInt(counterRow?.value || '1')
  const number  = `${prefix}-${String(counter).padStart(3, '0')}`

  return NextResponse.json({ data: { number, prefix, counter } })
}

// POST /api/settings/next-number?type=batch|deal
// Инкрементирует счётчик и возвращает следующий номер
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type')
  if (type !== 'batch' && type !== 'deal') {
    return NextResponse.json({ error: 'type must be batch or deal' }, { status: 400 })
  }

  const prefixKey  = type === 'batch' ? 'batch_number_prefix'  : 'deal_number_prefix'
  const counterKey = type === 'batch' ? 'batch_number_counter' : 'deal_number_counter'

  const result = await queryOne<{ number: string }>(
    `SELECT next_number($1, $2) AS number`,
    [prefixKey, counterKey]
  )

  return NextResponse.json({ data: { number: result?.number } })
}
