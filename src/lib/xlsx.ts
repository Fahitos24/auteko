import ExcelJS from 'exceljs'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Защита от формула-инъекции (CSV/Excel injection):
// строка, начинающаяся с = + - @ TAB CR, исполняется Excel как формула/DDE.
// Префикс ' делает её обычным текстом.
export function sanitizeCell<T>(v: T): T | string {
  if (typeof v !== 'string') return v
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

export interface SheetSpec {
  name: string
  columns: { header: string; width: number }[]
  rows: unknown[][]
  // true для служебных листов с нашими собственными статичными строками
  trusted?: boolean
}

export async function buildWorkbook(sheets: SheetSpec[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name)
    ws.columns = spec.columns.map(c => ({ header: c.header, width: c.width }))
    ws.getRow(1).font = { bold: true }
    for (const row of spec.rows) {
      ws.addRow(spec.trusted ? row : row.map(v => sanitizeCell(v)))
    }
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

// Приводим значение ячейки к простому типу (формулы, ссылки, rich text → текст)
function toPrimitive(v: ExcelJS.CellValue): string | number | boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if ('result' in o) return toPrimitive(o.result as ExcelJS.CellValue)
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map(t => t.text).join('')
    }
    if ('text' in o && typeof o.text === 'string') return o.text
  }
  return null
}

// Читает первый лист: первая строка = заголовки. Формулы не вычисляются, берётся сохранённый результат.
export async function readFirstSheet(buffer: Buffer, maxRows: number): Promise<Record<string, unknown>[] | 'too_many'> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  if (ws.actualRowCount - 1 > maxRows) return 'too_many'

  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(toPrimitive(cell.value) ?? '').trim()
  })

  const out: Record<string, unknown>[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Record<string, unknown> = {}
    let any = false
    headers.forEach((h, col) => {
      if (!h) return
      const val = toPrimitive(row.getCell(col).value)
      obj[h] = val ?? ''
      if (val !== null && val !== '') any = true
    })
    if (any) out.push(obj)
  })
  return out
}
