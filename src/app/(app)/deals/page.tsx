'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Deal, Client, Product, Batch } from '@/types'
import Tooltip from '@/components/ui/Tooltip'

const IconSearch   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconPlus     = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconEdit     = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconClose    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconDownload = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IconWarning  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>

const STATUSES = [
  { key: 'all',       label: 'Все',          color: 'var(--ink)' },
  { key: 'new',       label: 'Новые',        color: 'var(--blue-2)' },
  { key: 'confirmed', label: 'Подтверждены', color: 'var(--amber)' },
  { key: 'shipped',   label: 'Отгружены',    color: '#7c3aed' },
  { key: 'done',      label: 'Завершены',    color: 'var(--green)' },
  { key: 'cancelled', label: 'Отменены',     color: 'var(--ink-3)' },
] as const
type StatusKey = typeof STATUSES[number]['key']

const STATUS_COLOR: Record<string, string> = {
  new: 'var(--blue-2)', confirmed: 'var(--amber)',
  shipped: '#7c3aed',   done: 'var(--green)', cancelled: 'var(--ink-3)',
}

function fmtRub(n: unknown) {
  const num = Number(n); if (!n && n !== 0) return '—'; if (isNaN(num)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num) + ' ₽'
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—'; return new Date(s).toLocaleDateString('ru-RU')
}
function isOverdue(d: Deal) {
  if (!d.delivery_deadline) return false
  if (d.status === 'done' || d.status === 'cancelled') return false
  return new Date(d.delivery_deadline) < new Date()
}

const EMPTY_FORM = {
  deal_number: '', client_id: '', product_id: '', batch_id: '',
  contract_number: '', spec_number: '', quantity: '', price_with_vat: '',
  delivery_deadline: '', prepayment_date: '', actual_delivery_date: '',
  actual_payment_date: '', upd_number: '', upd_date: '',
  status: 'new' as StatusKey, notes: '',
}
type FormState = typeof EMPTY_FORM

export default function DealsPage() {
  const [deals, setDeals]         = useState<Deal[]>([])
  const [total, setTotal]         = useState(0)
  const [overdueCount, setOverdue] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<StatusKey>('all')
  const [showOverdue, setShowOverdue] = useState(false)

  const [clients, setClients]   = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches]   = useState<Batch[]>([])

  const [clientSearch, setClientSearch]   = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [showClientList, setShowClientList]   = useState(false)
  const [showProductList, setShowProductList] = useState(false)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing]     = useState<Deal | null>(null)
  const [form, setForm]           = useState<FormState>({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ search, status: statusFilter, limit: '200', ...(showOverdue ? { overdue: '1' } : {}) })
      const res = await fetch(`/api/deals?${p}`)
      const json = await res.json()
      setDeals(json.data || []); setTotal(json.total || 0); setOverdue(json.overdue_count || 0)
    } finally { setLoading(false) }
  }, [search, statusFilter, showOverdue])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients?limit=200').then(r => r.json()),
      fetch('/api/products?limit=200&status=active').then(r => r.json()),
    ]).then(([c, p]) => { setClients(c.data || []); setProducts(p.data || []) })
  }, [])

  useEffect(() => {
    if (!form.product_id) { setBatches([]); return }
    fetch(`/api/batches?product_id=${form.product_id}&limit=50`).then(r => r.json()).then(j => setBatches(j.data || []))
  }, [form.product_id])

  const filteredClients = useMemo(() =>
    clients.filter(c => c.company_name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.inn || '').includes(clientSearch)).slice(0, 8),
    [clients, clientSearch])

  const filteredProducts = useMemo(() =>
    products.filter(p => p.auteko_article.toLowerCase().includes(productSearch.toLowerCase()) || p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8),
    [products, productSearch])

  const selectedBatch = useMemo(() => batches.find(b => b.id === form.batch_id) || null, [batches, form.batch_id])

  const dealCalc = useMemo(() => {
    if (!selectedBatch || !form.price_with_vat || !form.quantity) return null
    const price = parseFloat(form.price_with_vat) || 0
    const qty   = parseInt(form.quantity) || 0
    const cost  = Number(selectedBatch.cost_price_rub)
    return { total: price * qty, profit: (price - cost) * qty, margin: cost > 0 ? ((price - cost) / price * 100) : 0, cost }
  }, [selectedBatch, form.price_with_vat, form.quantity])

  async function openCreate() {
    setEditing(null)
    const res  = await fetch('/api/settings/next-number?type=deal')
    const json = await res.json()
    setForm({ ...EMPTY_FORM, deal_number: json.data?.number || '' })
    setClientSearch(''); setProductSearch(''); setFormError(''); setPanelOpen(true)
  }

  function openEdit(d: Deal) {
    setEditing(d)
    setForm({
      deal_number: d.deal_number, client_id: d.client_id, product_id: d.product_id, batch_id: d.batch_id,
      contract_number: d.contract_number || '', spec_number: d.spec_number || '',
      quantity: d.quantity.toString(), price_with_vat: Number(d.price_with_vat).toString(),
      delivery_deadline:    d.delivery_deadline?.toString().split('T')[0]    || '',
      prepayment_date:      d.prepayment_date?.toString().split('T')[0]      || '',
      actual_delivery_date: d.actual_delivery_date?.toString().split('T')[0] || '',
      actual_payment_date:  d.actual_payment_date?.toString().split('T')[0]  || '',
      upd_number: d.upd_number || '', upd_date: d.upd_date?.toString().split('T')[0] || '',
      status: d.status as StatusKey, notes: d.notes || '',
    })
    setClientSearch((d as any).client_name || '')
    setProductSearch(`${(d as any).product_article || ''} — ${(d as any).product_name || ''}`)
    setFormError(''); setPanelOpen(true)
  }

  function closePanel() { setPanelOpen(false) }
  function setField(key: keyof FormState, val: string) { setForm(f => ({ ...f, [key]: val })) }

  function selectClient(c: Client) { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(c.company_name); setShowClientList(false) }
  function selectProduct(p: Product) { setForm(f => ({ ...f, product_id: p.id, batch_id: '' })); setProductSearch(`${p.auteko_article} — ${p.name}`); setShowProductList(false) }

  async function handleSave() {
    if (!form.deal_number.trim())  { setFormError('Введите номер сделки'); return }
    if (!form.client_id)           { setFormError('Выберите контрагента'); return }
    if (!form.product_id)          { setFormError('Выберите товар'); return }
    if (!form.batch_id)            { setFormError('Выберите партию'); return }
    if (!form.quantity || parseInt(form.quantity) <= 0) { setFormError('Введите количество'); return }
    if (!form.price_with_vat || parseFloat(form.price_with_vat) <= 0) { setFormError('Введите цену с НДС'); return }
    setSaving(true); setFormError('')
    try {
      const body = {
        deal_number: form.deal_number.trim(), client_id: form.client_id, product_id: form.product_id, batch_id: form.batch_id,
        contract_number: form.contract_number || null, spec_number: form.spec_number || null,
        quantity: parseInt(form.quantity), price_with_vat: parseFloat(form.price_with_vat),
        delivery_deadline: form.delivery_deadline || null, prepayment_date: form.prepayment_date || null,
        actual_delivery_date: form.actual_delivery_date || null, actual_payment_date: form.actual_payment_date || null,
        upd_number: form.upd_number || null, upd_date: form.upd_date || null,
        status: form.status, notes: form.notes || null,
      }
      const url = editing ? `/api/deals/${editing.id}` : '/api/deals'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error || 'Ошибка сохранения'); return }
      closePanel(); load()
    } finally { setSaving(false) }
  }

  async function handleCancel(d: Deal, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Отменить сделку ${d.deal_number}?`)) return
    await fetch(`/api/deals/${d.id}`, { method: 'DELETE' }); load()
  }

  async function exportExcel() {
    const res = await fetch('/api/deals/export'); const blob = await res.blob()
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `deals_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalAmount = deals.filter(d => d.status !== 'cancelled').reduce((s, d) => s + Number(d.total_amount || 0), 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: panelOpen ? 'min(460px, 40vw)' : '0', transition: 'margin-right .2s' }}>

        {/* Топбар */}
        <div className="page-topbar" style={{ height: '52px', flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap' }}>Сделки</span>
          <div className="topbar-stats" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px', borderRight: '1px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 500 }}>{total}</span>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>сделок</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 500, color: 'var(--blue-2)' }}>{fmtRub(totalAmount)}</span>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>сумма</span>
            </div>
            {overdueCount > 0 && (
              <button className="topbar-overdue" onClick={() => setShowOverdue(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '12px', padding: '3px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, background: showOverdue ? 'var(--red)' : 'var(--red-bg)', color: showOverdue ? '#fff' : 'var(--red)', transition: '.15s' }}>
                <IconWarning /> {overdueCount} просрочено
              </button>
            )}
          </div>
          <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button className="btn btn-outline btn-sm" onClick={exportExcel}><IconDownload /> <span className="btn-label">Экспорт</span></button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}><IconPlus /> <span className="btn-label">Добавить</span></button>
          </div>
        </div>

        {/* Фильтры статусов */}
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', padding: '0 16px', display: 'flex', alignItems: 'center', height: '42px', gap: '0' }}>
          <div className="status-filter-row" style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {STATUSES.map(s => (
              <button key={s.key} onClick={() => { setStatus(s.key); setShowOverdue(false) }} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: statusFilter === s.key && !showOverdue ? s.color : 'transparent', color: statusFilter === s.key && !showOverdue ? '#fff' : 'var(--ink-3)', transition: '.12s' }}>{s.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}><IconSearch /></span>
            <input className="input" style={{ paddingLeft: '30px', height: '28px', fontSize: '12px' }} placeholder="Поиск…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Таблица */}
        <div className="table-area" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' } as React.CSSProperties}>
          <table className="data-table" style={{ minWidth: '860px' }}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>№ сделки</th>
                <th style={{ width: '170px' }}>Контрагент</th>
                <th>Товар</th>
                <th style={{ width: '110px' }}>Партия</th>
                <th style={{ width: '65px' }}>Кол-во</th>
                <th style={{ width: '115px' }}><Tooltip text="Цена реализации с НДС за единицу товара." label="Цена с НДС" /></th>
                <th style={{ width: '115px' }}>Сумма</th>
                <th style={{ width: '115px' }}><Tooltip text="Срок поставки по договору. Красный если дата прошла и сделка не завершена." label="Срок поставки" /></th>
                <th style={{ width: '110px' }}>Статус</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-sub">Загрузка…</div></div></td></tr>
              ) : deals.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-title">{search ? 'Ничего не найдено' : 'Нет сделок'}</div><div className="empty-sub">{!search && 'Создайте первую сделку'}</div></div></td></tr>
              ) : deals.map(d => {
                const overdue = isOverdue(d)
                return (
                  <tr key={d.id} onClick={() => openEdit(d)} style={{ background: overdue ? '#fff8f8' : undefined }}>
                    <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '13px', color: overdue ? 'var(--red)' : 'var(--ink)' }}>{d.deal_number}</span></td>
                    <td>
                      <span className="cell-name" style={{ fontSize: '12.5px' }}>{(d as any).client_name}</span>
                      {d.contract_number && <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{d.contract_number}</div>}
                    </td>
                    <td>
                      <span className="cell-article" style={{ fontSize: '12px' }}>{(d as any).product_article}</span>
                      <div style={{ fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '1px' }}>{(d as any).product_name}</div>
                    </td>
                    <td><span className="cell-mono">{(d as any).batch_number}</span></td>
                    <td><span className="cell-num">{d.quantity}</span></td>
                    <td><span className="cell-num">{fmtRub(d.price_with_vat)}</span></td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--blue-2)' }}>{fmtRub(d.total_amount)}</span></td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: overdue ? 'var(--red)' : 'var(--ink-3)', fontWeight: overdue ? 600 : 400, display: 'flex', alignItems: 'center', gap: '4px' }}>{overdue && <IconWarning />}{fmtDate(d.delivery_deadline)}</span></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500, color: STATUS_COLOR[d.status] }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLOR[d.status], flexShrink: 0 }} />{STATUSES.find(s => s.key === d.status)?.label}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="row-btn" onClick={e => { e.stopPropagation(); openEdit(d) }}><IconEdit /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Затемнение на мобиле */}
      {panelOpen && <div className="panel-overlay" onClick={closePanel} />}

      {/* ПАНЕЛЬ */}
      {panelOpen && (
        <div className="side-panel" style={{ width: 'min(460px, 100vw)' }}>
          <div className="side-panel-head">
            <span className="side-panel-title">{editing ? `Сделка ${editing.deal_number}` : 'Новая сделка'}</span>
            <button className="side-panel-close" onClick={closePanel}><IconClose /></button>
          </div>
          <div className="side-panel-body">

            <div className="section-label">Идентификация</div>
            <div className="field-row">
              <div className="field">
                <label>№ сделки *</label>
                <input className="input input-mono" value={form.deal_number} onChange={e => setField('deal_number', e.target.value)} placeholder="R-001" disabled={!!editing} autoComplete="off" />
              </div>
              <div className="field">
                <label>Статус</label>
                <select className="input" value={form.status} onChange={e => setField('status', e.target.value)} style={{ fontFamily: 'var(--sans)' }}>
                  {STATUSES.filter(s => s.key !== 'all').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Контрагент */}
            <div className="field" style={{ position: 'relative' }}>
              <label>Контрагент *</label>
              <input className="input" value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientList(true) }} onFocus={() => setShowClientList(true)} placeholder="Начните вводить название…" autoComplete="off" disabled={!!editing} />
              {showClientList && filteredClients.length > 0 && !editing && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid var(--line)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto' }}>
                  {filteredClients.map(c => (
                    <div key={c.id} onClick={() => selectClient(c)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px', borderBottom: '1px solid var(--line-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span style={{ fontWeight: 500 }}>{c.company_name}</span>
                      {c.inn && <span style={{ color: 'var(--ink-3)', marginLeft: '8px', fontFamily: 'var(--mono)', fontSize: '11px' }}>{c.inn}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Товар */}
            <div className="field" style={{ position: 'relative' }}>
              <label>Товар *</label>
              <input className="input" value={productSearch} onChange={e => { setProductSearch(e.target.value); setShowProductList(true) }} onFocus={() => setShowProductList(true)} placeholder="Артикул или наименование…" autoComplete="off" disabled={!!editing} />
              {showProductList && filteredProducts.length > 0 && !editing && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid var(--line)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto' }}>
                  {filteredProducts.map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px', borderBottom: '1px solid var(--line-2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue-2)' }}>{p.auteko_article}</span>
                      <span style={{ color: 'var(--ink-3)', margin: '0 6px' }}>—</span><span>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Партия */}
            <div className="field">
              <label>Партия *</label>
              {batches.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', padding: '8px 0' }}>{form.product_id ? 'Нет доступных партий' : 'Сначала выберите товар'}</div>
              ) : (
                <select className="input" value={form.batch_id} onChange={e => setField('batch_id', e.target.value)} style={{ fontFamily: 'var(--sans)' }} disabled={!!editing}>
                  <option value="">— выберите партию —</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number} · С/С {fmtRub(b.cost_price_rub)} · КП {fmtRub(b.price_kp_rub)}</option>)}
                </select>
              )}
            </div>

            <div className="section-label">Договор</div>
            <div className="field-row">
              <div className="field"><label>№ договора</label><input className="input input-mono" value={form.contract_number} onChange={e => setField('contract_number', e.target.value)} placeholder="Д-12" autoComplete="off" /></div>
              <div className="field"><label>№ спецификации</label><input className="input input-mono" value={form.spec_number} onChange={e => setField('spec_number', e.target.value)} placeholder="Сп-1" autoComplete="off" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Количество, шт. *</label><input className="input input-mono" type="number" min="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} /></div>
              <div className="field">
                <label><Tooltip text="Цена продажи клиенту с НДС за единицу товара." label="Цена с НДС, ₽ *" /></label>
                <input className="input input-mono" type="number" min="0" step="0.01" value={form.price_with_vat} onChange={e => setField('price_with_vat', e.target.value)} />
              </div>
            </div>

            {/* Расчёт прибыли */}
            {dealCalc && (
              <div className="calc-box" style={{ marginBottom: '12px' }}>
                <div className="calc-row"><span className="calc-label">С/С из партии</span><span className="calc-val">{fmtRub(dealCalc.cost)}</span></div>
                <div className="calc-row"><span className="calc-label">Сумма сделки</span><span className="calc-val">{fmtRub(dealCalc.total)}</span></div>
                <div className="calc-row"><span className="calc-label">Прибыль · маржа {dealCalc.margin.toFixed(1)}%</span><span className="calc-val">{fmtRub(dealCalc.profit)}</span></div>
              </div>
            )}

            <div className="section-label">Даты</div>
            <div className="field-row">
              <div className="field"><label>Срок поставки</label><input className="input" type="date" value={form.delivery_deadline} onChange={e => setField('delivery_deadline', e.target.value)} /></div>
              <div className="field"><label>Дата предоплаты</label><input className="input" type="date" value={form.prepayment_date} onChange={e => setField('prepayment_date', e.target.value)} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Факт. поставка</label><input className="input" type="date" value={form.actual_delivery_date} onChange={e => setField('actual_delivery_date', e.target.value)} /></div>
              <div className="field"><label>Факт. оплата</label><input className="input" type="date" value={form.actual_payment_date} onChange={e => setField('actual_payment_date', e.target.value)} /></div>
            </div>

            <div className="section-label"><Tooltip text="УПД — Универсальный передаточный документ. Заменяет счёт-фактуру и накладную. Оформляется при отгрузке." label="УПД" /></div>
            <div className="field-row">
              <div className="field"><label>№ УПД</label><input className="input input-mono" value={form.upd_number} onChange={e => setField('upd_number', e.target.value)} placeholder="45" autoComplete="off" /></div>
              <div className="field"><label>Дата УПД</label><input className="input" type="date" value={form.upd_date} onChange={e => setField('upd_date', e.target.value)} /></div>
            </div>

            <div className="section-label">Примечания</div>
            <div className="field">
              <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Любые заметки по сделке…" rows={2} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} autoComplete="off" />
            </div>

            {editing && editing.status !== 'cancelled' && (
              <button onClick={e => handleCancel(editing, e)} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>Отменить сделку</button>
            )}
            {formError && <div className="notice notice-error" style={{ marginTop: '8px' }}>{formError}</div>}
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
