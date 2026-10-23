'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Product } from '@/types'
import Tooltip from '@/components/ui/Tooltip'

const ENGINE_MODELS = ['12М55', '12-16М33', '16М33', '12М33']

const EMPTY_FORM = {
  auteko_article:      '',
  original_articles:   [] as string[],
  name:                '',
  engine_models:       [] as string[],
  tnved_code:          '',
  production_days_min: '',
  production_days_max: '',
  is_available:        true,
  notes:               '',
  status:              'active' as const,
  stock_threshold_yellow: null as number | null,
  stock_threshold_red:    null as number | null,
}

const IconSearch   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconEdit     = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconArchive  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
const IconRestore  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
const IconDownload = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IconUpload   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const IconPlus     = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconClose    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconFile     = () => <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>

function parseArticles(val: string) {
  return val.split('/').map(s => s.trim()).filter(Boolean)
}

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [engine, setEngine]         = useState('all')
  const [statusFilter, setStatus]   = useState('active')
  const [panelOpen, setPanelOpen]   = useState(false)
  const [panelMode, setPanelMode]   = useState<'form'|'import'>('form')
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p   = new URLSearchParams({ search, engine, status: statusFilter, limit: '100' })
      const res = await fetch(`/api/products?${p}`)
      const json = await res.json()
      setProducts(json.data || [])
      setTotal(json.total || 0)
    } finally { setLoading(false) }
  }, [search, engine, statusFilter])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  function openCreate() {
    setEditing(null); setForm({ ...EMPTY_FORM }); setFormError('')
    setPanelMode('form'); setPanelOpen(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      auteko_article:      p.auteko_article,
      original_articles:   p.original_articles || [],
      name:                p.name,
      engine_models:       p.engine_models || [],
      tnved_code:          p.tnved_code || '',
      production_days_min: p.production_days_min?.toString() || '',
      production_days_max: p.production_days_max?.toString() || '',
      is_available:        p.is_available,
      notes:               p.notes || '',
      status:              p.status,
      stock_threshold_yellow: (p as any).stock_threshold_yellow ?? null,
      stock_threshold_red:    (p as any).stock_threshold_red    ?? null,
    })
    setFormError(''); setPanelMode('form'); setPanelOpen(true)
  }
  function openImport() { setImportResult(null); setPanelMode('import'); setPanelOpen(true) }
  function closePanel() { setPanelOpen(false) }

  async function handleSave() {
    if (!form.auteko_article.trim() || !form.name.trim()) {
      setFormError('Заполните обязательные поля: Артикул и Наименование'); return
    }
    setSaving(true); setFormError('')
    try {
      const body = {
        ...form,
        tnved_code:          form.tnved_code.trim() || null,
        production_days_min: form.production_days_min ? parseInt(form.production_days_min) : null,
        production_days_max: form.production_days_max ? parseInt(form.production_days_max) : null,
        notes:               form.notes.trim() || null,
        stock_threshold_yellow: form.stock_threshold_yellow,
        stock_threshold_red:    form.stock_threshold_red,
      }
      const url    = editing ? `/api/products/${editing.id}` : '/api/products'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { setFormError(json.error || 'Ошибка сохранения'); return }
      closePanel(); load()
    } finally { setSaving(false) }
  }

  async function handleArchive(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Перевести "${p.name}" в архив?`)) return
    await fetch(`/api/products/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) })
    load()
  }
  async function handleRestore(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/products/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
    load()
  }
  async function downloadTemplate() {
    const res = await fetch('/api/products/import'); const blob = await res.blob()
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'auteko_template.xlsx'; a.click(); URL.revokeObjectURL(url)
  }
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportResult(null)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/products/import', { method: 'POST', body: fd })
    const json = await res.json()
    setImporting(false); setImportResult(json.data)
    if (e.target) e.target.value = ''
    load()
  }
  function toggleEngine(model: string) {
    setForm(f => ({ ...f, engine_models: f.engine_models.includes(model) ? f.engine_models.filter(m => m !== model) : [...f.engine_models, model] }))
  }

  const activeCount   = products.filter(p => p.status === 'active').length
  const inactiveCount = products.filter(p => !p.is_available && p.status === 'active').length

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div className="page-shift" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: panelOpen ? 'clamp(0px, 400px, 40vw)' : '0', transition: 'margin-right .2s' }}>

        {/* Топбар */}
        <div className="page-topbar" style={{ height: '52px', flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap' }}>Номенклатура</span>

          {/* Статистика — скрывается на мобиле */}
          <div className="topbar-stats" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {[
              { label: 'позиций', value: total, color: 'var(--ink)' },
              { label: 'активных', value: activeCount, color: 'var(--green)' },
              { label: 'не поставляется', value: inactiveCount, color: 'var(--red)' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 500, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexShrink: 0 }}>
            {/* На десктопе — все кнопки, на мобиле — только главная */}
            <button className="btn btn-outline btn-sm desktop-only" onClick={downloadTemplate} style={{ display: 'none' }}><IconDownload /> Шаблон</button>
            <button className="btn btn-outline btn-sm desktop-only" onClick={openImport} style={{ display: 'none' }}><IconUpload /> Импорт</button>
            <button className="btn btn-outline btn-sm" onClick={downloadTemplate}
              style={{ fontSize: '12px' }}
              title="Шаблон .xlsx">
              <IconDownload />
              <span style={{ display: 'var(--btn-text-display, inline)' }}>Шаблон</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={openImport}
              style={{ fontSize: '12px' }} title="Импорт Excel">
              <IconUpload />
              <span style={{ display: 'var(--btn-text-display, inline)' }}>Импорт</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ fontSize: '12px' }}>
              <IconPlus />
              <span>Добавить</span>
            </button>
          </div>
        </div>

        {/* Тулбар поиска */}
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '140px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}><IconSearch /></span>
            <input className="input" style={{ paddingLeft: '30px', fontSize: '13px' }}
              placeholder="Поиск по артикулу, названию…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto', fontFamily: 'var(--sans)', fontSize: '13px', flex: '0 0 auto' }} value={engine} onChange={e => setEngine(e.target.value)}>
            <option value="all">Все ДВС</option>
            {ENGINE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 'auto', fontFamily: 'var(--sans)', fontSize: '13px', flex: '0 0 auto' }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="active">Активные</option>
            <option value="archived">Архив</option>
            <option value="all">Все</option>
          </select>
        </div>

        {/* Таблица — горизонтальный скролл на мобиле */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <table className="data-table" style={{ minWidth: '620px' }}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}><Tooltip text="Внутренний каталожный номер AUTEKO. Уникален для каждой позиции." label="Кат. № AUTEKO" /></th>
                <th style={{ width: '180px' }}><Tooltip text="Оригинальный номер от производителя. Если несколько — через /." label="Кат. № оригинал" /></th>
                <th>Наименование</th>
                <th style={{ width: '130px' }}><Tooltip text="Модель дизельного двигателя для которой подходит запчасть." label="Модель ДВС" /></th>
                <th style={{ width: '100px' }}><Tooltip text="Срок изготовления на заводе поставщика." label="Срок изг." /></th>
                <th style={{ width: '110px' }}>Статус</th>
                <th style={{ width: '64px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-sub">Загрузка…</div></div></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-title">{search ? 'Ничего не найдено' : 'Нет товаров'}</div>
                    <div className="empty-sub">{!search && 'Добавьте первый товар или импортируйте из Excel'}</div>
                  </div>
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} onClick={() => openEdit(p)}>
                  <td><span className="cell-article" style={{ color: p.status === 'archived' ? 'var(--ink-3)' : undefined }}>{p.auteko_article}</span></td>
                  <td><span className="cell-mono">{(p.original_articles || []).join(' / ') || '—'}</span></td>
                  <td><span className="cell-name">{p.name}</span></td>
                  <td>{(p.engine_models || []).map(m => <span key={m} className="dvs-tag">{m}</span>)}</td>
                  <td><span className="cell-meta">{p.production_days_min && p.production_days_max ? `${p.production_days_min}–${p.production_days_max} дн.` : '—'}</span></td>
                  <td>
                    {p.status === 'archived' ? <span className="status status-archive"><span className="status-dot"/>Архив</span>
                      : p.is_available ? <span className="status status-active"><span className="status-dot"/>Активен</span>
                      : <span className="status status-inactive"><span className="status-dot"/>Не поставляется</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="row-btn" onClick={e => { e.stopPropagation(); openEdit(p) }}><IconEdit /></button>
                      {p.status === 'active'
                        ? <button className="row-btn" onClick={e => handleArchive(p, e)}><IconArchive /></button>
                        : <button className="row-btn" onClick={e => handleRestore(p, e)}><IconRestore /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ПАНЕЛЬ */}
      {panelOpen && (
        <>
          {/* Затемнение только на мобиле */}
          <div onClick={closePanel} style={{
            display: 'none',
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 49,
          }} className="mobile-overlay" />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(400px, 100vw)',
            background: '#fff', borderLeft: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column', zIndex: 50,
            boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
          }} className="side-panel">
            <div style={{ height: '52px', flexShrink: 0, padding: '0 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                {panelMode === 'import' ? 'Импорт из Excel' : editing ? `Редактировать — ${editing.auteko_article}` : 'Новый товар'}
              </span>
              <button onClick={closePanel} style={{ width: '28px', height: '28px', border: '1px solid var(--line)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}><IconClose /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {panelMode === 'form' && (
                <>
                  <div className="section-label">Основное</div>
                  <div className="field">
                    <label>Кат. № AUTEKO *</label>
                    <input className="input input-mono" value={form.auteko_article} onChange={e => setForm(f => ({ ...f, auteko_article: e.target.value }))} placeholder="AV-i16471" disabled={!!editing} autoComplete="off" />
                  </div>
                  <div className="field">
                    <label>Наименование *</label>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Топливная форсунка в сборе" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label><Tooltip text="Оригинальный номер от производителя. Если несколько — вводите через /." label="Кат. № оригинал" /></label>
                    <input className="input input-mono" value={(form.original_articles || []).join(' / ')} onChange={e => setForm(f => ({ ...f, original_articles: parseArticles(e.target.value) }))} placeholder="445120471 / 331005001218" autoComplete="off" />
                  </div>

                  <div className="section-label">Применимость</div>
                  <div className="field">
                    <label>Модель ДВС</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {ENGINE_MODELS.map(m => (
                        <button key={m} type="button" onClick={() => toggleEngine(m)} style={{ padding: '4px 12px', borderRadius: '3px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--mono)', border: '1px solid', borderColor: (form.engine_models || []).includes(m) ? 'var(--blue)' : 'var(--line)', background: (form.engine_models || []).includes(m) ? 'var(--blue-bg)' : 'var(--page)', color: (form.engine_models || []).includes(m) ? 'var(--blue)' : 'var(--ink-3)' }}>{m}</button>
                      ))}
                      <button type="button" onClick={() => setForm(f => ({ ...f, engine_models: f.engine_models.includes('все') ? f.engine_models.filter(x => x !== 'все') : ['все'] }))} style={{ padding: '4px 12px', borderRadius: '3px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--mono)', border: '1px solid', borderColor: (form.engine_models || []).includes('все') ? 'var(--blue)' : 'var(--line)', background: (form.engine_models || []).includes('все') ? 'var(--blue-bg)' : 'var(--page)', color: (form.engine_models || []).includes('все') ? 'var(--blue)' : 'var(--ink-3)' }}>Все модели</button>
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Срок изг., дней от</label>
                      <input className="input input-mono" type="number" min="0" value={form.production_days_min} onChange={e => setForm(f => ({ ...f, production_days_min: e.target.value }))} placeholder="60" />
                    </div>
                    <div className="field">
                      <label>до</label>
                      <input className="input input-mono" type="number" min="0" value={form.production_days_max} onChange={e => setForm(f => ({ ...f, production_days_max: e.target.value }))} placeholder="90" />
                    </div>
                  </div>

                  <div className="section-label">Дополнительно</div>
                  <div className="field">
                    <label><Tooltip text="ТНВЭД — 10-значный код определяющий ставку таможенной пошлины." label="Код ТНВЭД" /></label>
                    <input className="input input-mono" value={form.tnved_code} onChange={e => setForm(f => ({ ...f, tnved_code: e.target.value }))} placeholder="8409919900" maxLength={10} autoComplete="off" />
                  </div>
                  <div className="field">
                    <label>Примечания</label>
                    <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Любые заметки…" rows={2} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} autoComplete="off" />
                  </div>

                  <div className="section-label"><Tooltip text="Если задано — переопределяет глобальные пороги из Настроек для этого товара." label="Пороги остатков" /></div>
                  <div className="field-row">
                    <div className="field">
                      <label style={{ color: 'var(--amber)' }}>Жёлтый ≤ шт.</label>
                      <input className="input input-mono" type="number" min="0"
                        value={form.stock_threshold_yellow ?? ''}
                        onChange={e => setForm(f => ({ ...f, stock_threshold_yellow: e.target.value === '' ? null : parseInt(e.target.value) }))}
                        placeholder="глобальный" />
                    </div>
                    <div className="field">
                      <label style={{ color: 'var(--red)' }}>Красный ≤ шт.</label>
                      <input className="input input-mono" type="number" min="0"
                        value={form.stock_threshold_red ?? ''}
                        onChange={e => setForm(f => ({ ...f, stock_threshold_red: e.target.value === '' ? null : parseInt(e.target.value) }))}
                        placeholder="глобальный" />
                    </div>
                  </div>

                  <div className="checkbox-row" style={{ marginBottom: '16px' }}>
                    <input type="checkbox" id="is_available" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                    <label htmlFor="is_available">Поставляется</label>
                  </div>
                  {formError && <div className="notice notice-error">{formError}</div>}
                </>
              )}

              {panelMode === 'import' && (
                <>
                  <div className="import-drop" onClick={() => fileRef.current?.click()}>
                    <div style={{ color: 'var(--ink-3)', display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><IconFile /></div>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{importing ? 'Загрузка…' : 'Нажмите для выбора файла'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Формат .xlsx</div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
                  </div>
                  <button className="btn btn-outline" onClick={downloadTemplate} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                    <IconDownload /> Скачать шаблон
                  </button>
                  {importResult && (
                    <div className="notice notice-success" style={{ marginTop: '12px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Импорт завершён</div>
                      <div>Добавлено: <b>{importResult.created}</b></div>
                      <div>Пропущено: <b>{importResult.skipped}</b></div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0 }}>
              {panelMode === 'form' ? (
                <>
                  <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
                  <button className="btn btn-outline btn-lg" onClick={closePanel}>Отмена</button>
                </>
              ) : (
                <button className="btn btn-outline btn-lg" onClick={closePanel} style={{ flex: 1, justifyContent: 'center' }}>Закрыть</button>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .topbar-stats { display: none !important; }
          .side-panel {
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-height: 90vh;
            border-radius: 14px 14px 0 0 !important;
            border-left: none !important;
            border-top: 1px solid var(--line) !important;
          }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  )
}
