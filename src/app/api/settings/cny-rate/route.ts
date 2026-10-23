import { NextResponse } from 'next/server'

// GET /api/settings/cny-rate
// Подтягивает актуальный курс юаня с сайта ЦБ РФ
export async function GET() {
  try {
    const today = new Date().toLocaleDateString('ru-RU').replace(/\./g, '/')
    const url   = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${today}`

    const res  = await fetch(url, {
      next: { revalidate: 3600 }, // кэш на 1 час
      headers: { 'Accept': 'application/xml' },
    })

    if (!res.ok) throw new Error('ЦБ недоступен')

    const xml  = await res.text()

    // Парсим XML — ищем юань (CNY, CharCode = CNY, Nominal = 1)
    const match = xml.match(/<Valute[^>]*>[\s\S]*?<CharCode>CNY<\/CharCode>[\s\S]*?<Nominal>(\d+)<\/Nominal>[\s\S]*?<Value>([\d,]+)<\/Value>[\s\S]*?<\/Valute>/)

    if (!match) throw new Error('Курс CNY не найден в ответе ЦБ')

    const nominal = parseInt(match[1])
    const value   = parseFloat(match[2].replace(',', '.'))
    const rate    = value / nominal // за 1 юань

    return NextResponse.json({
      data: {
        rate:     Math.round(rate * 10000) / 10000, // 4 знака после запятой
        nominal,
        date:     new Date().toISOString().split('T')[0],
        source:   'ЦБ РФ',
      }
    })
  } catch (err) {
    console.error('CNY rate error:', err)
    return NextResponse.json(
      { error: 'Не удалось получить курс ЦБ. Введите вручную.' },
      { status: 503 }
    )
  }
}
