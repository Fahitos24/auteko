import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
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

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Остатки')

  const buf  = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="stock_${date}.xlsx"`,
    },
  })
}
