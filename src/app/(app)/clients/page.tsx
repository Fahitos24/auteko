'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Client } from '@/types'

const IconSearch = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconPlus   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconEdit   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IconDelete = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
const IconClose  = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

const EMPTY_FORM = {
  company_name:   '',
  inn:            '',
  contact_person: '',
  phone:          '',
  email:          '',
  notes:          '',
}

type ClientWithCount = Client & { deals_count: string }

export default function ClientsPage() {
  const [clients, setClients]   = useState<ClientWithCount[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing]     = useState<Client | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p   = new URLSearchParams({ search, limit: '100' })
      const res = await fetch(`/api/clients?${p}`)
      const json = await res.json()
      setClients(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setPanelOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      company_name:   c.company_name,
      inn:            c.inn            || '',
      contact_person: c.contact_person || '',
      phone:          c.phone          || '',
      email:          c.email          || '',
      notes:          c.notes          || '',
    })
    setFormError('')
    setPanelOpen(true)
  }

  function closePanel() { setPanelOpen(false) }

  function setField(key: keyof typeof EMPTY_FORM, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.company_name.trim()) {
      setFormError('Введите наименование организации')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const body   = {
        company_name:   form.company_name.trim(),
        inn:            form.inn.trim()            || null,
        contact_person: form.contact_person.trim() || null,
        phone:          form.phone.trim()          || null,
        email:          form.email.trim()          || null,
        notes:          form.notes.trim()          || null,
      }
      const url    = editing ? `/api/clients/${editing.id}` : '/api/clients'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error || 'Ошибка сохранения'); return }
      closePanel()
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: ClientWithCount, e: React.MouseEvent) {
    e.stopPropagation()
    const count = parseInt(c.deals_count || '0')
    if (count > 0) {
      alert(`Нельзя удалить: у контрагента ${count} активных сделок`)
      return
    }
    if (!confirm(`Удалить "${c.company_name}"?`)) return
    const res = await fetch(`/api/clients/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error || 'Ошибка удаления')
      return
    }
    load()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* КОНТЕНТ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: panelOpen ? 'min(400px, 40vw)' : '0',
        transition: 'margin-right .2s',
      }}>

        {/* Топбар */}
        <div className="page-topbar" style={{
          height: '52px', flexShrink: 0,
          background: '#fff', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>Контрагенты</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 16px', borderRight: '1px solid var(--line)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 500 }}>{total}</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>организаций</span>
          </div>
          <div className="topbar-actions" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <IconPlus /> Добавить
            </button>
          </div>
        </div>

        {/* Поиск */}
        <div style={{
          height: '46px', flexShrink: 0,
          background: '#fff', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', padding: '0 20px',
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}>
              <IconSearch />
            </span>
            <input className="input" style={{ paddingLeft: '30px' }}
              placeholder="Поиск по названию, ИНН, контакту…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Таблица */}
        <div className="table-area" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th>Организация</th>
                <th style={{ width: '130px' }}>ИНН</th>
                <th style={{ width: '180px' }}>Контактное лицо</th>
                <th style={{ width: '150px' }}>Телефон</th>
                <th style={{ width: '200px' }}>Email</th>
                <th style={{ width: '80px' }}>Сделок</th>
                <th style={{ width: '64px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-sub">Загрузка…</div></div></td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-title">{search ? 'Ничего не найдено' : 'Нет контрагентов'}</div>
                    <div className="empty-sub">{!search && 'Добавьте первого контрагента'}</div>
                  </div>
                </td></tr>
              ) : clients.map(c => (
                <tr key={c.id} onClick={() => openEdit(c)}>
                  <td><span className="cell-name">{c.company_name}</span></td>
                  <td><span className="cell-mono">{c.inn || '—'}</span></td>
                  <td><span className="cell-meta">{c.contact_person || '—'}</span></td>
                  <td><span className="cell-mono" style={{ fontSize: '12px' }}>{c.phone || '—'}</span></td>
                  <td><span className="cell-mono" style={{ fontSize: '12px', color: c.email ? 'var(--blue-2)' : 'var(--ink-3)' }}>{c.email || '—'}</span></td>
                  <td>
                    {parseInt(c.deals_count || '0') > 0
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px', background: 'var(--blue-bg)', color: 'var(--blue-2)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 600 }}>{c.deals_count}</span>
                      : <span className="cell-meta">—</span>
                    }
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="row-btn" title="Редактировать" onClick={e => { e.stopPropagation(); openEdit(c) }}><IconEdit /></button>
                      <button className="row-btn" title="Удалить" onClick={e => handleDelete(c, e)} style={{ color: 'var(--red)' }}><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ПАНЕЛЬ */}
      {panelOpen && <div className="panel-overlay" onClick={closePanel} />}
      {panelOpen && (
        <div className="side-panel">
          <div className="side-panel-head">
            <span className="side-panel-title">
              {editing ? 'Редактировать контрагента' : 'Новый контрагент'}
            </span>
            <button className="side-panel-close" onClick={closePanel}><IconClose /></button>
          </div>

          <div className="side-panel-body">
            <div className="section-label">Организация</div>
            <div className="field">
              <label>Наименование *</label>
              <input className="input" value={form.company_name}
                onChange={e => setField('company_name', e.target.value)}
                placeholder="ООО ТоргСнаб"
                autoComplete="off" />
            </div>
            <div className="field">
              <label>ИНН</label>
              <input className="input input-mono" value={form.inn}
                onChange={e => setField('inn', e.target.value)}
                placeholder="7712345678" maxLength={12}
                autoComplete="off" />
            </div>

            <div className="section-label">Контакт</div>
            <div className="field">
              <label>Контактное лицо</label>
              <input className="input" value={form.contact_person}
                onChange={e => setField('contact_person', e.target.value)}
                placeholder="Иванов Иван Иванович"
                autoComplete="off" />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input className="input input-mono" value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                placeholder="+7 999 123-45-67"
                autoComplete="off"
                type="text" />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input input-mono" value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="ivanov@company.ru"
                autoComplete="off"
                type="text" />
            </div>

            <div className="section-label">Дополнительно</div>
            <div className="field">
              <label>Примечания</label>
              <textarea className="input" value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Любые заметки о клиенте…"
                rows={3} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
                autoComplete="off" />
            </div>

            {formError && <div className="notice notice-error">{formError}</div>}
          </div>

          <div className="side-panel-foot">
            <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}
              style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button className="btn btn-outline btn-lg" onClick={closePanel}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
