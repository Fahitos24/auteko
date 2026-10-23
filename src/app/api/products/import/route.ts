import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Колонки шаблона
const TEMPLATE_COLUMNS = [
  'auteko_article',
  'original_articles',
  'name',
  'engine_models',
  'tnved_code',
  'production_days_min',
  'production_days_max',
  'is_available',
  'notes',
]

// GET /api/products/import — скачать шаблон
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = XLSX.utils.book_new()

  // Лист с данными
  const exampleData = [
    TEMPLATE_COLUMNS,
    [
      'AV-i16471',
      '445120471 / 331005001218',
      'Топливная форсунка в сборе',
      '12-16М33',
      '8409919900',
      60,
      90,
      'да',
      '',
    ],
    [
      'AV-i16472',
      '445120013',
      'Плунжерная пара',
      '12М55 / 16М33',
      '',
      45,
      60,
      'да',
      '',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet(exampleData)

  // Ширина колонок
  ws['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 20 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Номенклатура')

  // Лист с инструкцией
  const instructions = [
    ['Поле', 'Обязательное', 'Описание'],
    ['auteko_article', 'ДА', 'Уникальный артикул AUTEKO (например AV-i16471)'],
    ['original_articles', 'нет', 'Оригинальные номера через " / "'],
    ['name', 'ДА', 'Полное наименование товара'],
    ['engine_models', 'нет', 'Модели ДВС через " / " (12М55 / 16М33) или "все"'],
    ['tnved_code', 'нет', '10-значный код ТНВЭД'],
    ['production_days_min', 'нет', 'Минимальный срок изготовления (дней)'],
    ['production_days_max', 'нет', 'Максимальный срок изготовления (дней)'],
    ['is_available', 'нет', '"да" или "нет" (по умолчанию "да")'],
    ['notes', 'нет', 'Примечания'],
  ]

  const wsInfo = XLSX.utils.aoa_to_sheet(instructions)
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 55 }]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Инструкция')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="auteko_template.xlsx"',
    },
  })
}

// POST /api/products/import — загрузить Excel
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Файл пустой' }, { status: 400 })
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] }

    for (const row of rows) {
      const article = String(row['auteko_article'] || '').trim()
      const name    = String(row['name'] || '').trim()

      if (!article || !name) {
        results.errors.push(`Пропущена строка: нет артикула или названия`)
        results.skipped++
        continue
      }

      // Парсим массивы
      const originalArticles = String(row['original_articles'] || '')
        .split('/').map(s => s.trim()).filter(Boolean)

      const engineModels = String(row['engine_models'] || '')
        .split('/').map(s => s.trim()).filter(Boolean)

      const isAvailable = String(row['is_available'] || 'да').toLowerCase() !== 'нет'

      try {
        const existing = await queryOne(
          'SELECT id FROM products WHERE auteko_article = $1',
          [article]
        )

        if (existing) {
          results.skipped++
          continue
        }

        await query(`
          INSERT INTO products (
            auteko_article, original_articles, name, engine_models,
            tnved_code, production_days_min, production_days_max,
            is_available, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          article,
          originalArticles,
          name,
          engineModels,
          String(row['tnved_code'] || '').trim() || null,
          parseInt(String(row['production_days_min'])) || null,
          parseInt(String(row['production_days_max'])) || null,
          isAvailable,
          String(row['notes'] || '').trim() || null,
        ])

        results.created++
      } catch (err) {
        results.errors.push(`Артикул ${article}: ошибка записи`)
        results.skipped++
      }
    }

    return NextResponse.json({ data: results })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Ошибка обработки файла' }, { status: 500 })
  }
}
