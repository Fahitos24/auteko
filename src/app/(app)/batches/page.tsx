'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Batch, Product } from '@/types'
import Tooltip from '@/components/ui/Tooltip'

const IconSearch = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconPlus   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconEdit   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconDelete = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
const IconClose  = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

function fmtRub(n: unknown) {
  const num = Number(n)
  if (!n && n !== 0) return '—'
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num) + ' ₽'
}
function fmtCny(n: unknown) {
  const num = Number(n)
  if (!n && n !== 0) return '—'
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num) + ' ¥'
}

const EMPTY_FORM = {
  batch_number:       '',
  product_id:         '',
  quantity:           '',
  price_exw_cny:      '',
  cny_rate:           '',
  cny_rate_date:      new Date().toISOString().split('T')[0],
  customs_duty_pct:   '0',
  transport_cost:     '0',
  other_costs:        '0',
  markup_coefficient: '1.25',
  gtd_number:         '',
  gtd_date:           '',
}
type FormState = typeof EMPTY_FORM

// Компонент поля курса ЦБ
function CnyRateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [cbr, setCbr]   = useState<number | null>(null)
  const [cbrDate, setCbrDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function fetchCbr() {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/settings/cny-rate')
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Ошибка'); return }
      setCbr(json.data.rate); setCbrDate(json.data.date)
    } catch { setError('Нет связи с ЦБ РФ') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchCbr() }, [])

  const diff = cbr && value ? parseFloat(value) - cbr : null

  return (
    <div>
      {loading && <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginBottom: '6px' }}>Загружаем курс ЦБ…</div>}
      {cbr && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', marginBottom: '6px', background: 'var(--page)', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '12px', gap: '8px' }}>
          <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
            ЦБ на {new Date(cbrDate).toLocaleDateString('ru-RU')}:{' '}
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)' }}>{cbr.toFixed(4)} ₽</span>
          </span>
          <button type="button" onClick={() => onChange(cbr.toFixed(4))} style={{ padding: '2px 10px', fontSize: '11.5px', fontWeight: 500, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }}>
            Использовать
          </button>
        </div>
      )}
      {error && <div style={{ fontSize: '11.5px', color: 'var(--amber)', marginBottom: '6px' }}>{error} — введите вручную</div>}
      <input className="input input-mono" type="number" min="0" step="0.0001"
        value={value} onChange={e => onChange(e.target.value)} placeholder="12.8500" />
      {diff !== null && Math.abs(diff) > 0.001 && (
        <div style={{ fontSize: '11.5px', marginTop: '4px', color: Math.abs(diff) > 0.5 ? 'var(--amber)' : 'var(--ink-3)' }}>
          {diff > 0 ? '▲' : '▼'} Отличается от ЦБ на{' '}
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{Math.abs(diff).toFixed(4)} ₽</span>
          {' '}— реальный курс сделки
        </div>
      )}
      {diff !== null && Math.abs(diff) <= 0.001 && value && (
        <div style={{ fontSize: '11.5px', marginTop: '4px', color: 'var(--green)' }}>✓ Совпадает с курсом ЦБ</div>
      )}
    </div>
  )
}

export default function BatchesPage() {
  const [batches, setBatches]   = useState<Batch[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductList, setShowProductList] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing]     = useState<Batch | null>(null)
  const [form, setForm]           = useState<FormState>({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ search, limit: '100' })
      const res = await fetch(`/api/batches?${p}`)
      const json = await res.json()
      setBatches(json.data || []); setTotal(json.total || 0)
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => {
    fetch('/api/products?limit=200&status=active').then(r => r.json()).then(j => setProducts(j.data || []))
  }, [])

  const filteredProducts = useMemo(() =>
    products.filter(p =>
      p.auteko_article.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10), [products, productSearch])

  const calc = useMemo(() => {
    const buy    = parseFloat(form.price_exw_cny)    || 0
    const rate   = parseFloat(form.cny_rate)          || 0
    const qty    = parseInt(form.quantity)             || 1
    const duty   = parseFloat(form.customs_duty_pct)  || 0
    const ship   = parseFloat(form.transport_cost)    || 0
    const other  = parseFloat(form.other_costs)       || 0
    const markup = parseFloat(form.markup_coefficient) || 1
    if (!buy || !rate) return null
    const exwRub    = buy * rate
    const dutyAmt   = exwRub * (duty / 100)
    const perUnit   = (ship + other) / qty
    const costPrice = exwRub + dutyAmt + perUnit
    const kpPrice   = costPrice * markup
    const profit    = kpPrice - costPrice
    return { exwRub, dutyAmt, perUnit, costPrice, kpPrice, profit }
  }, [form.price_exw_cny, form.cny_rate, form.quantity, form.customs_duty_pct, form.transport_cost, form.other_costs, form.markup_coefficient])

  async function loadDefaults() {
    const [numRes, settingsRes] = await Promise.all([
      fetch('/api/settings/next-number?type=batch'),
      fetch('/api/settings'),
    ])
    const [numJson, settingsJson] = await Promise.all([numRes.json(), settingsRes.json()])
    return {
      number: numJson.data?.number || '',
      markup: settingsJson.data?.default_markup?.toString() || '1.25',
    }
  }

  async function openCreate() {
    setEditing(null)
    const defaults = await loadDefaults()
    setForm({ ...EMPTY_FORM, batch_number: defaults.number, markup_coefficient: defaults.markup })
    setProductSearch(''); setFormError(''); setPanelOpen(true)
  }

  function openEdit(b: Batch) {
    setEditing(b)
    setForm({
      batch_number:       b.batch_number,
      product_id:         b.product_id,
      quantity:           b.quantity.toString(),
      price_exw_cny:      b.price_exw_cny.toString(),
      cny_rate:           Number(b.cny_rate).toString(),
      cny_rate_date:      b.cny_rate_date?.toString().split('T')[0] || '',
      customs_duty_pct:   b.customs_duty_pct.toString(),
      transport_cost:     b.transport_cost.toString(),
      other_costs:        b.other_costs.toString(),
      markup_coefficient: b.markup_coefficient.toString(),
      gtd_number:         b.gtd_number || '',
      gtd_date:           b.gtd_date?.toString().split('T')[0] || '',
    })
    setProductSearch(b.product_article ? `${b.product_article} — ${b.product_name}` : '')
    setFormError(''); setPanelOpen(true)
  }

  function closePanel() { setPanelOpen(false) }
  function setField(key: keyof FormState, val: string) { setForm(f => ({ ...f, [key]: val })) }
  function selectProduct(p: Product) {
    setForm(f => ({ ...f, product_id: p.id }))
    setProductSearch(`${p.auteko_article} — ${p.name}`)
    setShowProductList(false)
  }

  async function handleSave() {
    if (!form.batch_number.trim())                        { setFormError('Введите номер партии'); return }
    if (!form.product_id)                                 { setFormError('Выберите товар'); return }
    if (!form.quantity || parseInt(form.quantity) <= 0)   { setFormError('Введите количество'); return }
    if (!form.price_exw_cny || parseFloat(form.price_exw_cny) <= 0) { setFormError('Введите цену EXW'); return }
    if (!form.cny_rate || parseFloat(form.cny_rate) <= 0) { setFormError('Введите курс юаня'); return }
    setSaving(true); setFormError('')
    try {
      const body = {
        batch_number:       form.batch_number.trim(),
        product_id:         form.product_id,
        quantity:           parseInt(form.quantity),
        price_exw_cny:      parseFloat(form.price_exw_cny),
        cny_rate:           parseFloat(form.cny_rate),
        cny_rate_date:      form.cny_rate_date,
        customs_duty_pct:   parseFloat(form.customs_duty_pct) || 0,
        transport_cost:     parseFloat(form.transport_cost)   || 0,
        other_costs:        parseFloat(form.other_costs)      || 0,
        markup_coefficient: parseFloat(form.markup_coefficient) || 1.25,
        gtd_number:         form.gtd_number.trim() || null,
        gtd_date:           form.gtd_date || null,
      }
      const url    = editing ? `/api/batches/${editing.id}` : '/api/batches'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { setFormError(json.error || 'Ошибка сохранения'); return }
      closePanel(); load()
    } finally { setSaving(false) }
  }

  async function handleDelete(b: Batch, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Удалить партию ${b.batch_number}?`)) return
    const res = await fetch(`/api/batches/${b.id}`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Ошибка'); return }
    load()
  }

  const totalUnits = batches.reduce((s, b) => s + b.quantity, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: panelOpen ? 'min(440px, 40vw)' : '0', transition: 'margin-right .2s' }}>

        {/* Топбар */}
        <div className="page-topbar" style={{ height: '52px', flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap' }}>Партии</span>
          <div className="topbar-stats" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px', borderRight: '1px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 500 }}>{total}</span>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>партий</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 500, color: 'var(--blue-2)' }}>{totalUnits}</span>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>единиц</span>
            </div>
          </div>
          <div className="topbar-actions" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <IconPlus /> <span className="btn-label">Добавить</span>
            </button>
          </div>
        </div>

        {/* Поиск */}
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 16px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}><IconSearch /></span>
            <input className="input" style={{ paddingLeft: '30px' }}
              placeholder="Поиск по номеру партии, артикулу…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Таблица */}
        <div className="table-area" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' } as React.CSSProperties}>
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>№ партии</th>
                <th style={{ width: '120px' }}>Арт. AUTEKO</th>
                <th>Наименование</th>
                <th style={{ width: '80px' }}>Кол-во</th>
                <th style={{ width: '110px' }}><Tooltip text="EXW — цена на складе поставщика в Китае, в юанях за единицу." label="Цена EXW" /></th>
                <th style={{ width: '90px' }}><Tooltip text="Курс юаня к рублю на дату закупки, зафиксированный вручную." label="Курс CNY" /></th>
                <th style={{ width: '120px' }}><Tooltip text="Себестоимость за единицу: EXW × курс + пошлина + логистика." label="С/С руб./ед." /></th>
                <th style={{ width: '120px' }}><Tooltip text="Цена коммерческого предложения = С/С × коэффициент наценки." label="Цена КП" /></th>
                <th style={{ width: '110px' }}><Tooltip text="Прибыль с одной единицы = Цена КП − Себестоимость." label="Прибыль/ед." /></th>
                <th style={{ width: '64px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-sub">Загрузка…</div></div></td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-title">{search ? 'Ничего не найдено' : 'Нет партий'}</div><div className="empty-sub">{!search && 'Создайте первую партию'}</div></div></td></tr>
              ) : batches.map(b => (
                <tr key={b.id} onClick={() => openEdit(b)}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '12.5px' }}>{b.batch_number}</span></td>
                  <td><span className="cell-article">{b.product_article}</span></td>
                  <td><span className="cell-name">{b.product_name}</span></td>
                  <td><span className="cell-num">{b.quantity}</span></td>
                  <td><span className="cell-mono">{fmtCny(b.price_exw_cny)}</span></td>
                  <td><span className="cell-mono">{Number(b.cny_rate).toFixed(2)}</span></td>
                  <td><span className="cell-num">{fmtRub(b.cost_price_rub)}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--blue-2)' }}>{fmtRub(b.price_kp_rub)}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: 'var(--green)' }}>+{fmtRub(b.profit_per_unit)}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="row-btn" onClick={e => { e.stopPropagation(); openEdit(b) }}><IconEdit /></button>
                      <button className="row-btn" style={{ color: 'var(--red)' }} onClick={e => handleDelete(b, e)}><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Затемнение на мобиле */}
      {panelOpen && <div className="panel-overlay" onClick={closePanel} />}

      {/* ПАНЕЛЬ */}
      {panelOpen && (
        <div className="side-panel">
          <div className="side-panel-head">
            <span className="side-panel-title">{editing ? `Партия ${editing.batch_number}` : 'Новая партия'}</span>
            <button className="side-panel-close" onClick={closePanel}><IconClose /></button>
          </div>
          <div className="side-panel-body">
            <div className="section-label">Идентификация</div>
            <div className="field-row">
              <div className="field">
                <label>№ партии *</label>
                <input className="input input-mono" value={form.batch_number} onChange={e => setField('batch_number', e.target.value)} placeholder="P-001" disabled={!!editing} autoComplete="off" />
              </div>
              <div className="field">
                <label>Дата курса *</label>
                <input className="input" type="date" value={form.cny_rate_date} onChange={e => setField('cny_rate_date', e.target.value)} />
              </div>
            </div>

            <div className="field" style={{ position: 'relative' }}>
              <label>Товар (арт. AUTEKO) *</label>
              <input className="input" value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductList(true) }}
                onFocus={() => setShowProductList(true)}
                placeholder="Начните вводить артикул или название…"
                disabled={!!editing} autoComplete="off" />
              {showProductList && filteredProducts.length > 0 && !editing && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid var(--line)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredProducts.map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px', borderBottom: '1px solid var(--line-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue-2)' }}>{p.auteko_article}</span>
                      <span style={{ color: 'var(--ink-3)', margin: '0 6px' }}>—</span>
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="section-label">Закупка</div>
            <div className="field-row">
              <div className="field">
                <label>Количество, шт. *</label>
                <input className="input input-mono" type="number" min="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} placeholder="10" />
              </div>
              <div className="field">
                <label><Tooltip text="EXW — цена на складе поставщика в юанях за единицу, без доставки и таможни." label="Цена EXW, ¥/ед. *" /></label>
                <input className="input input-mono" type="number" min="0" step="0.01" value={form.price_exw_cny} onChange={e => setField('price_exw_cny', e.target.value)} placeholder="1850" />
              </div>
            </div>
            <div className="field">
              <label><Tooltip text="Курс юаня к рублю. Подтягивается с ЦБ РФ автоматически — можно скорректировать на реальный курс сделки." label="Курс CNY → ₽ *" /></label>
              <CnyRateField value={form.cny_rate} onChange={v => setField('cny_rate', v)} />
            </div>

            <div className="section-label">Расходы (руб., на всю партию)</div>
            <div className="field-row">
              <div className="field">
                <label><Tooltip text="Таможенная пошлина в % от стоимости EXW в рублях. Ставка по коду ТНВЭД." label="Пошлина, %" /></label>
                <input className="input input-mono" type="number" min="0" max="100" step="0.1" value={form.customs_duty_pct} onChange={e => setField('customs_duty_pct', e.target.value)} placeholder="8" />
              </div>
              <div className="field">
                <label><Tooltip text="Общая стоимость доставки всей партии. Делится на количество единиц." label="Доставка, ₽" /></label>
                <input className="input input-mono" type="number" min="0" value={form.transport_cost} onChange={e => setField('transport_cost', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="field">
              <label><Tooltip text="Брокер, сертификация, хранение и прочее. Также делится на количество единиц." label="Прочие расходы, ₽" /></label>
              <input className="input input-mono" type="number" min="0" value={form.other_costs} onChange={e => setField('other_costs', e.target.value)} placeholder="0" />
            </div>

            <div className="section-label">Наценка</div>
            <div className="field">
              <label><Tooltip text={'Коэффициент умножается на себестоимость:\n1.25 → наценка 25%\n1.50 → наценка 50%\nЦена КП = С/С × Коэффициент'} label="Коэффициент наценки" /></label>
              <input className="input input-mono" type="number" min="1" step="0.01" value={form.markup_coefficient} onChange={e => setField('markup_coefficient', e.target.value)} placeholder="1.25" />
              <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '3px' }}>1.25 = наценка 25% · 1.5 = наценка 50%</div>
            </div>

            {/* Живой расчёт */}
            {calc && (
              <>
                <div className="section-label">Расчёт (обновляется автоматически)</div>
                <div className="calc-box">
                  <div className="calc-row"><span className="calc-label">EXW в рублях</span><span className="calc-val">{fmtRub(calc.exwRub)}</span></div>
                  <div className="calc-row"><span className="calc-label">+ Пошлина {form.customs_duty_pct}%</span><span className="calc-val">{fmtRub(calc.dutyAmt)}</span></div>
                  <div className="calc-row"><span className="calc-label">+ Логистика на ед.</span><span className="calc-val">{fmtRub(calc.perUnit)}</span></div>
                  <div className="calc-row"><span className="calc-label">Себестоимость/ед.</span><span className="calc-val">{fmtRub(calc.costPrice)}</span></div>
                  <div className="calc-row"><span className="calc-label">Прибыль с ед.</span><span className="calc-val" style={{ color: 'var(--green)' }}>+{fmtRub(calc.profit)}</span></div>
                  <div className="calc-row"><span className="calc-label">Цена КП / ед.</span><span className="calc-val">{fmtRub(calc.kpPrice)}</span></div>
                </div>
              </>
            )}

            <div className="section-label">Таможня</div>
            <div className="field">
              <label><Tooltip text="ГТД — Грузовая таможенная декларация. Номер присваивается при растаможке. Можно заполнить позже." label="Номер ГТД" /></label>
              <input className="input input-mono" value={form.gtd_number} onChange={e => setField('gtd_number', e.target.value)} placeholder="10210020/051026/0012345" autoComplete="off" />
            </div>
            <div className="field">
              <label>Дата ГТД</label>
              <input className="input" type="date" value={form.gtd_date} onChange={e => setField('gtd_date', e.target.value)} />
            </div>

            {formError && <div className="notice notice-error">{formError}</div>}
          </div>
          <div className="side-panel-foot">
            <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
            <button className="btn btn-outline btn-lg" onClick={closePanel}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
