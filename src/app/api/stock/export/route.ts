import { NextResponse } from 'next/server'
import { buildWorkbook, XLSX_MIME } from '@/lib/xlsx'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'

const STATUS_LABELS: Record<string, string> = {
  green:  'В наличии',
  yellow: 'Мало',
  red:    'Нет',
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      auteko_article        AS "Арт. AUTEKO",
      name                  AS "Наименование",
      batch_number          AS "№ партии",
      received              AS "Поступило",
      sold                  AS "Продано",
      balance               AS "Остаток",
      cost_price_rub        AS "С/С руб./ед.",
      price_kp_rub          AS "Цена КП руб./ед.",
      balance * price_kp_rub AS "Стоимость остатка, руб.",
      stock_status          AS "Статус"
    FROM stock_balance
    ORDER BY name ASC, batch_number ASC
  `)

  const data = rows.map(r => ({
    ...r,
    'С/С руб./ед.':            Number(r['С/С руб./ед.']),
    'Цена КП руб./ед.':        Number(r['Цена КП руб./ед.']),
    'Стоимость остатка, руб.': Number(r['Стоимость остатка, руб.']),
    'Статус': STATUS_LABELS[r['Статус'] as string] || r['Статус'],
  }))

  const widths = [14,40,12,10,10,10,16,16,22,14]
  const headers = Object.keys(data[0] ?? {})
  const buf = await buildWorkbook([{
    name: 'Остатки',
    columns: headers.map((h, i) => ({ header: h, width: widths[i] ?? 14 })),
    rows: data.map(r => headers.map(h => (r as Record<string, unknown>)[h])),
  }])
  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="stock_${date}.xlsx"`,
    },
  })
  } catch (err) {
    console.error('GET /api/stock/export error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
