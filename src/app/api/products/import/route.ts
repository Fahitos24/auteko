import { NextRequest, NextResponse } from 'next/server'
import { buildWorkbook, readFirstSheet, XLSX_MIME } from '@/lib/xlsx'
import { withTransaction } from '@/lib/db'
import { z } from 'zod'
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

  const buf = await buildWorkbook([
    {
      name: 'Номенклатура',
      trusted: true,
      columns: TEMPLATE_COLUMNS.map((h, i) => ({ header: h, width: [15,25,40,20,14,10,10,10,30][i] })),
      rows: [
        ['AV-i16471', '445120471 / 331005001218', 'Топливная форсунка в сборе', '12-16М33', '8409919900', 60, 90, 'да', ''],
        ['AV-i16472', '445120013', 'Плунжерная пара', '12М55 / 16М33', '', 45, 60, 'да', ''],
      ],
    },
    {
      name: 'Инструкция',
      trusted: true,
      columns: [{ header: 'Поле', width: 22 }, { header: 'Обязательное', width: 14 }, { header: 'Описание', width: 55 }],
      rows: [
        ['auteko_article', 'ДА', 'Уникальный артикул AUTEKO (например AV-i16471)'],
        ['original_articles', 'нет', 'Оригинальные номера через " / "'],
        ['name', 'ДА', 'Полное наименование товара'],
        ['engine_models', 'нет', 'Модели ДВС через " / " (12М55 / 16М33) или "все"'],
        ['tnved_code', 'нет', '10-значный код ТНВЭД'],
        ['production_days_min', 'нет', 'Минимальный срок изготовления (дней)'],
        ['production_days_max', 'нет', 'Максимальный срок изготовления (дней)'],
        ['is_available', 'нет', '"да" или "нет" (по умолчанию "да")'],
        ['notes', 'нет', 'Примечания'],
      ],
    },
  ])

  return new NextResponse(buf, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': 'attachment; filename="auteko_template.xlsx"',
    },
  })
}

// Ограничения импорта
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 5000

const rowSchema = z.object({
  article:   z.string().min(1).max(50),
  name:      z.string().min(1).max(500),
  original:  z.array(z.string().max(100)).max(50),
  engines:   z.array(z.string().max(100)).max(50),
  tnved:     z.string().regex(/^\d{1,10}$/).nullable(),
  daysMin:   z.number().int().min(0).max(3650).nullable(),
  daysMax:   z.number().int().min(0).max(3650).nullable(),
  available: z.boolean(),
  notes:     z.string().max(2000).nullable(),
})

function intOrNull(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

// POST /api/products/import — загрузить Excel
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })

    if (!file.name.toLowerCase().endsWith('.xlsx') || (file.type && file.type !== XLSX_MIME)) {
      return NextResponse.json({ error: 'Допустим только файл .xlsx' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Файл больше 5 МБ' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // .xlsx это zip: проверяем сигнатуру PK
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return NextResponse.json({ error: 'Файл не похож на .xlsx' }, { status: 400 })
    }

    const parsed = await readFirstSheet(buffer, MAX_ROWS)
    if (parsed === 'too_many') {
      return NextResponse.json({ error: `Слишком много строк (максимум ${MAX_ROWS})` }, { status: 413 })
    }
    const rows = parsed
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Файл пустой' }, { status: 400 })
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] }

    // Сначала валидируем все строки, потом пишем одной транзакцией
    const valid: z.infer<typeof rowSchema>[] = []
    rows.forEach((row, i) => {
      const parsed = rowSchema.safeParse({
        article:   String(row['auteko_article'] ?? '').trim(),
        name:      String(row['name'] ?? '').trim(),
        original:  String(row['original_articles'] ?? '').split('/').map(x => x.trim()).filter(Boolean),
        engines:   String(row['engine_models'] ?? '').split('/').map(x => x.trim()).filter(Boolean),
        tnved:     String(row['tnved_code'] ?? '').trim() || null,
        daysMin:   intOrNull(row['production_days_min']),
        daysMax:   intOrNull(row['production_days_max']),
        available: String(row['is_available'] || 'да').toLowerCase() !== 'нет',
        notes:     String(row['notes'] ?? '').trim() || null,
      })
      if (parsed.success) valid.push(parsed.data)
      else {
        results.errors.push(`Строка ${i + 2}: некорректные данные`)
        results.skipped++
      }
    })

    await withTransaction(async (c) => {
      for (const r of valid) {
        // NOT EXISTS вместо ON CONFLICT: не требует UNIQUE-констрейнта в схеме
        const ins = await c.query(`
          INSERT INTO products (
            auteko_article, original_articles, name, engine_models,
            tnved_code, production_days_min, production_days_max,
            is_available, notes
          )
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
          WHERE NOT EXISTS (SELECT 1 FROM products WHERE auteko_article = $1)
        `, [r.article, r.original, r.name, r.engines, r.tnved, r.daysMin, r.daysMax, r.available, r.notes])
        if (ins.rowCount) results.created++
        else results.skipped++
      }
    })

    return NextResponse.json({ data: results })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Ошибка обработки файла' }, { status: 500 })
  }
}
