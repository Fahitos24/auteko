import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'

const STATUS_LABELS: Record<string, string> = {
  new:       'Новая',
  confirmed: 'Подтверждена',
  shipped:   'Отгружена',
  done:      'Завершена',
  cancelled: 'Отменена',
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU')
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deals = await query<Record<string, unknown>>(`
    SELECT
      d.deal_number          AS "№ сделки",
      c.company_name         AS "Контрагент",
      d.contract_number      AS "№ договора",
      d.spec_number          AS "№ спецификации",
      pr.auteko_article      AS "Арт. AUTEKO",
      pr.name                AS "Наименование",
      b.batch_number         AS "№ партии",
      d.quantity             AS "Кол-во",
      b.cost_price_rub       AS "С/С руб./ед.",
      d.price_with_vat       AS "Цена с НДС руб./ед.",
      d.total_amount         AS "Сумма сделки, руб.",
      (d.price_with_vat - b.cost_price_rub) * d.quantity AS "Прибыль, руб.",
      d.delivery_deadline    AS "Срок поставки",
      d.prepayment_date      AS "Дата предоплаты",
      d.actual_delivery_date AS "Дата факт. поставки",
      d.actual_payment_date  AS "Дата факт. оплаты",
      d.upd_number           AS "№ УПД",
      d.upd_date             AS "Дата УПД",
      d.status               AS "Статус",
      d.notes                AS "Примечания",
      d.created_at           AS "Создана"
    FROM deals d
    JOIN clients  c  ON c.id  = d.client_id
    JOIN products pr ON pr.id = d.product_id
    JOIN batches  b  ON b.id  = d.batch_id
    ORDER BY d.created_at DESC
  `)

  // Форматируем даты и статусы
  const rows = deals.map(d => ({
    ...d,
    'Срок поставки':       fmtDate(d['Срок поставки'] as string),
    'Дата предоплаты':     fmtDate(d['Дата предоплаты'] as string),
    'Дата факт. поставки': fmtDate(d['Дата факт. поставки'] as string),
    'Дата факт. оплаты':   fmtDate(d['Дата факт. оплаты'] as string),
    'Дата УПД':            fmtDate(d['Дата УПД'] as string),
    'Создана':             fmtDate(d['Создана'] as string),
    'Статус':              STATUS_LABELS[d['Статус'] as string] || d['Статус'],
    'С/С руб./ед.':        Number(d['С/С руб./ед.']),
    'Цена с НДС руб./ед.': Number(d['Цена с НДС руб./ед.']),
    'Сумма сделки, руб.':  Number(d['Сумма сделки, руб.']),
    'Прибыль, руб.':       Number(d['Прибыль, руб.']),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Ширина колонок
  ws['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 8 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Реестр реализации')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="deals_${date}.xlsx"`,
    },
  })
}
