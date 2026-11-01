#!/usr/bin/env node
// Демо-данные: клиенты, партии, сделки (остатки считаются сами из партий и сделок).
//
//   node scripts/seed-demo.js           добавить демо-данные (если уже есть, остановится)
//   node scripts/seed-demo.js --reset   удалить прежние демо-данные и создать заново
//   node scripts/seed-demo.js --clean   только удалить демо-данные
//
// Все демо-записи помечены, поэтому ваши реальные данные не затрагиваются:
//   клиенты: примечание начинается с "[DEMO]"
//   партии:  номер вида P-DEMO-01
//   сделки:  номер вида R-DEMO-001
// Товары (номенклатуру) скрипт не создаёт, а берёт существующие активные.
// Себестоимость и цену КП в партиях считает триггер БД.

const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const args = process.argv.slice(2)
const CLEAN = args.includes('--clean')
const RESET = args.includes('--reset')

// Дата относительно сегодня в формате YYYY-MM-DD
function day(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
const round2 = n => Math.round(n * 100) / 100

// ─── Клиенты ─────────────────────────────────────────────────────────
// ИНН 10 цифр = юрлицо, 12 цифр = ИП; у части клиентов нет email/телефона/контактного лица
const CLIENTS = [
  { company_name: 'ООО «Волжский судоремонт»',   inn: '5258123456', contact_person: 'Сергей Андреевич Мельников', phone: '+7 831 255-14-70', email: 'snab@volga-sr.example', notes: 'Постоянный клиент, работает по предоплате 50%' },
  { company_name: 'АО «Северная верфь-Сервис»',  inn: '7805987654', contact_person: 'Ольга Викторовна Крылова',   phone: '+7 812 640-22-18', email: 'o.krylova@sever-verf.example', notes: 'Крупный заказчик, оплата по факту поставки' },
  { company_name: 'ИП Тарасов Игорь Николаевич', inn: '525812345678', contact_person: 'Игорь Тарасов',            phone: '+7 910 380-45-12', email: null, notes: 'Небольшие разовые заказы' },
  { company_name: 'ООО «Дальневосточный флот»',  inn: '2540112233', contact_person: 'Артём Ким',                 phone: '+7 423 245-90-31', email: 'zakupki@dv-flot.example', notes: 'Доставка на Владивосток, срок до 40 дней' },
  { company_name: 'ООО «Термо-Моторс»',          inn: '6670445566', contact_person: null,                        phone: '+7 343 310-77-05', email: 'info@termo-motors.example', notes: null },
  { company_name: 'ПАО «Каспийский порт»',       inn: '3015778899', contact_person: 'Заур Магомедов',            phone: '+7 8512 44-18-60', email: 'ts@kaspport.example', notes: 'Требуется ГТД в комплекте документов' },
  { company_name: 'ИП Белова Марина Сергеевна',  inn: '772012345678', contact_person: 'Марина Белова',            phone: null, email: 'belova.m@example.com', notes: 'Оплата только по счёту' },
  { company_name: 'ООО «Энергомаш-Юг»',          inn: '2310334455', contact_person: 'Павел Руденко',             phone: '+7 861 210-33-47', email: 'pavel@energomash-yug.example', notes: 'Новый клиент, первая сделка в работе' },
  { company_name: 'ООО «Байкал-Дизель» (архив)', inn: '3811556677', contact_person: null,                        phone: null, email: null, notes: 'Не заказывает с прошлого года, сделок нет' },
]

// ─── Партии ──────────────────────────────────────────────────────────
// p = индекс товара из выбранных (0..), price_exw_cny, cny_rate, duty %, transport/other руб. на всю партию
const BATCHES = [
  /* 01 */ { p: 0, qty: 120, cny: 410.0, rate: 11.35, duty: 10, transport: 38000, other: 9000,  markup: 1.25, gtd: '10702070/041026/5001234', gtdAge: -25, age: -40 },
  /* 02 */ { p: 1, qty: 60,  cny: 285.5, rate: 11.40, duty: 10, transport: 21000, other: 4500,  markup: 1.30, gtd: '10702070/150926/5000987', gtdAge: -45, age: -60 },
  /* 03 */ { p: 2, qty: 25,  cny: 940.0, rate: 11.22, duty: 5,  transport: 18000, other: 3000,  markup: 1.25, gtd: '10702070/020926/5000755', gtdAge: -58, age: -75 },
  /* 04 */ { p: 3, qty: 40,  cny: 175.0, rate: 11.50, duty: 0,  transport: 9500,  other: 0,     markup: 1.20, gtd: null, gtdAge: 0, age: -70 },
  /* 05 */ { p: 4, qty: 200, cny: 62.0,  rate: 11.30, duty: 15, transport: 27000, other: 6000,  markup: 1.40, gtd: '10702070/211026/5001402', gtdAge: -10, age: -12 },
  /* 06 */ { p: 5, qty: 30,  cny: 520.0, rate: 11.45, duty: 10, transport: 14000, other: 2500,  markup: 1.25, gtd: null, gtdAge: 0, age: -30 },
  /* 07 */ { p: 0, qty: 80,  cny: 430.0, rate: 11.75, duty: 10, transport: 31000, other: 7000,  markup: 1.25, gtd: null, gtdAge: 0, age: -5 },  // тот же товар, другой курс и ещё без ГТД
  /* 08 */ { p: 6, qty: 15,  cny: 1380.0, rate: 11.18, duty: 5, transport: 16500, other: 5200,  markup: 1.35, gtd: '10702070/091026/5001311', gtdAge: -20, age: -35 },
  /* 09 */ { p: 7, qty: 50,  cny: 98.0,  rate: 11.38, duty: 10, transport: 12000, other: 1800,  markup: 1.25, gtd: '10702070/251026/5001466', gtdAge: -6, age: -9 },
]

// ─── Сделки ──────────────────────────────────────────────────────────
// b = номер партии (1..), c = индекс клиента (0..)
// k = цена с НДС относительно цены КП партии (1.0 = по КП, <1 = со скидкой, <себестоимости = убыток)
// dl = срок поставки относительно сегодня (дней), отрицательный = в прошлом
const DEALS = [
  // Партия 01: остаток 30 (зелёный)
  { b: 1, c: 0, qty: 40, status: 'done',      k: 1.00, dl: -20, prepay: -38, delivered: -22, paid: -15, upd: true },
  { b: 1, c: 1, qty: 30, status: 'shipped',   k: 1.05, dl: -3,  prepay: -14, delivered: -2,  contract: true },   // отгружена, срок прошёл → просрочена
  { b: 1, c: 5, qty: 20, status: 'confirmed', k: 1.00, dl: 12,  prepay: -2,  contract: true },
  // Партия 02: остаток 3 (жёлтый)
  { b: 2, c: 3, qty: 35, status: 'done',      k: 1.08, dl: -30, prepay: -52, delivered: -32, paid: -28, upd: true },
  { b: 2, c: 0, qty: 22, status: 'shipped',   k: 1.00, dl: 4,   prepay: -10, delivered: -1,  contract: true },
  // Партия 03: остаток 1 (красный)
  { b: 3, c: 1, qty: 12, status: 'done',      k: 0.97, dl: -40, prepay: -70, delivered: -42, paid: -35, upd: true },
  { b: 3, c: 2, qty: 12, status: 'confirmed', k: 1.00, dl: -5,  prepay: -20, contract: true },                   // подтверждена, срок прошёл → просрочена
  // Партия 04: остаток 0 (красный, продана полностью)
  { b: 4, c: 4, qty: 25, status: 'done',      k: 1.04, dl: -45, prepay: -65, delivered: -47, paid: -40, upd: true },
  { b: 4, c: 6, qty: 15, status: 'done',      k: 0.60, dl: -35, prepay: null, delivered: -36, paid: -30, upd: true, notes: 'Продано ниже себестоимости (залежавшийся товар), убыток по сделке' },
  // Партия 05: нет сделок вообще (остаток 200, партию можно удалять)
  // Партия 06: только отменённые сделки (остаток 30 не уменьшается)
  { b: 6, c: 7, qty: 20, status: 'cancelled', k: 1.00, dl: -10, prepay: null, notes: 'Клиент отказался: не устроил срок поставки' },
  { b: 6, c: 2, qty: 10, status: 'cancelled', k: 1.02, dl: 5,   prepay: null, notes: 'Дубль сделки, создана по ошибке' },
  // Партия 07: остаток 4 (жёлтый)
  { b: 7, c: 7, qty: 60, status: 'new',       k: 1.00, dl: 21,  prepay: null },
  { b: 7, c: 4, qty: 16, status: 'new',       k: 1.10, dl: -2,  prepay: null },                                   // новая, срок прошёл → просрочена
  // Партия 08: остаток 5 (жёлтый, на границе порога)
  { b: 8, c: 5, qty: 10, status: 'confirmed', k: 1.03, dl: 18,  prepay: -1,  contract: true, notes: 'ГТД и сертификаты приложить к отгрузке' },
  // Партия 09: остаток 14 (зелёный), крупная сделка без договора на старте
  { b: 9, c: 1, qty: 36, status: 'new',       k: 0.95, dl: 30,  prepay: null, notes: 'Согласование условий, договор в проработке' },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL не найден. Запускайте из папки проекта, где есть .env.local')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const c = await pool.connect()

  try {
    await c.query('BEGIN')

    const have = await c.query(`SELECT
      (SELECT COUNT(*) FROM clients WHERE notes LIKE '[DEMO]%')::int AS clients,
      (SELECT COUNT(*) FROM batches WHERE batch_number LIKE 'P-DEMO-%')::int AS batches,
      (SELECT COUNT(*) FROM deals   WHERE deal_number  LIKE 'R-DEMO-%')::int AS deals`)
    const h = have.rows[0]
    const exists = h.clients + h.batches + h.deals > 0

    if (exists && !CLEAN && !RESET) {
      console.error(`Демо-данные уже есть (клиентов: ${h.clients}, партий: ${h.batches}, сделок: ${h.deals}).`)
      console.error('Используйте --reset, чтобы пересоздать, или --clean, чтобы удалить.')
      await c.query('ROLLBACK')
      process.exit(1)
    }

    if (exists || CLEAN) {
      // Порядок важен из-за внешних ключей: сделки → партии → клиенты
      const d1 = await c.query(`DELETE FROM deals   WHERE deal_number  LIKE 'R-DEMO-%'`)
      const d2 = await c.query(`DELETE FROM batches WHERE batch_number LIKE 'P-DEMO-%'`)
      const d3 = await c.query(`DELETE FROM clients WHERE notes LIKE '[DEMO]%'`)
      console.log(`Удалено демо-данных: сделок ${d1.rowCount}, партий ${d2.rowCount}, клиентов ${d3.rowCount}`)
      if (CLEAN) { await c.query('COMMIT'); return }
    }

    // Товары берём существующие: равномерно из активных, чтобы были разные позиции
    const prods = (await c.query(
      `SELECT id, auteko_article, name FROM products WHERE status = 'active' ORDER BY auteko_article`
    )).rows
    if (prods.length < 4) {
      throw new Error(`В номенклатуре мало активных товаров (${prods.length}). Нужно минимум 4. Сначала загрузите товары.`)
    }
    const step = Math.max(1, Math.floor(prods.length / 8))
    const picked = Array.from({ length: 8 }, (_, i) => prods[(i * step) % prods.length])

    // Проверка: продано не больше, чем в партии
    const soldBy = {}
    for (const d of DEALS) {
      if (d.status !== 'cancelled') soldBy[d.b] = (soldBy[d.b] || 0) + d.qty
    }
    for (const [b, sold] of Object.entries(soldBy)) {
      if (sold > BATCHES[b - 1].qty) throw new Error(`Партия ${b}: продано ${sold} > ${BATCHES[b - 1].qty}`)
    }

    // Клиенты
    const clientIds = []
    for (const cl of CLIENTS) {
      const r = await c.query(
        `INSERT INTO clients (company_name, inn, contact_person, phone, email, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [cl.company_name, cl.inn, cl.contact_person, cl.phone, cl.email, `[DEMO] ${cl.notes || ''}`.trim()]
      )
      clientIds.push(r.rows[0].id)
    }

    // Партии (себестоимость и цену КП считает триггер)
    const batchRows = []
    for (let i = 0; i < BATCHES.length; i++) {
      const b = BATCHES[i]
      const r = await c.query(
        `INSERT INTO batches (
           batch_number, product_id, quantity, price_exw_cny, cny_rate, cny_rate_date,
           customs_duty_pct, transport_cost, other_costs, markup_coefficient, gtd_number, gtd_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, product_id, cost_price_rub, price_kp_rub`,
        [
          `P-DEMO-${String(i + 1).padStart(2, '0')}`,
          picked[b.p].id, b.qty, b.cny, b.rate, day(b.age),
          b.duty, b.transport, b.other, b.markup,
          b.gtd, b.gtd ? day(b.gtdAge) : null,
        ]
      )
      batchRows.push(r.rows[0])
    }

    // Сделки
    let n = 0
    for (const d of DEALS) {
      n++
      const batch = batchRows[d.b - 1]
      const kp = Number(batch.price_kp_rub)
      const cost = Number(batch.cost_price_rub)
      // Убыточная сделка: цена ниже себестоимости, иначе цена КП × коэффициент
      const price = round2(d.k < 0.7 ? cost * d.k : kp * d.k)
      const num = String(n).padStart(3, '0')
      const hasContract = d.contract || d.status === 'done'

      await c.query(
        `INSERT INTO deals (
           deal_number, client_id, product_id, batch_id,
           contract_number, spec_number, quantity, price_with_vat,
           delivery_deadline, prepayment_date, actual_delivery_date, actual_payment_date,
           upd_number, upd_date, status, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          `R-DEMO-${num}`, clientIds[d.c], batch.product_id, batch.id,
          hasContract ? `Д-${2026}/${num}` : null,
          hasContract ? `Спец. №${n}` : null,
          d.qty, price,
          day(d.dl),
          d.prepay != null ? day(d.prepay) : null,
          d.delivered != null ? day(d.delivered) : null,
          d.paid != null ? day(d.paid) : null,
          d.upd ? `УПД-${num}` : null,
          d.upd && d.delivered != null ? day(d.delivered) : null,
          d.status, d.notes || null,
        ]
      )
    }

    await c.query('COMMIT')
    console.log(`Готово: клиентов ${CLIENTS.length}, партий ${BATCHES.length}, сделок ${DEALS.length}.`)
    console.log('Остатки пересчитаны автоматически. Удалить демо-данные: node scripts/seed-demo.js --clean')
  } catch (err) {
    await c.query('ROLLBACK')
    console.error('Ошибка, ничего не записано:', err.message)
    process.exitCode = 1
  } finally {
    c.release()
    await pool.end()
  }
}

main()
