'use client'

import { useState, useEffect } from 'react'
import type { Settings } from '@/app/api/settings/route'
import Tooltip from '@/components/ui/Tooltip'

const IconSave    = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const IconRefresh = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>

const EMPTY: Settings = {
  stock_threshold_yellow: 5,
  stock_threshold_red:    1,
  default_markup:         1.25,
  batch_number_prefix:    'P',
  batch_number_counter:   1,
  deal_number_prefix:     'R',
  deal_number_counter:    1,
  company_name:           '',
  company_inn:            '',
  company_address:        '',
}

export default function SettingsPage() {
  const [form, setForm]       = useState<Settings>({ ...EMPTY })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(j => { if (j.data) setForm(j.data) })
      .finally(() => setLoading(false))
  }, [])

  function setField<K extends keyof Settings>(key: K, val: Settings[K]) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res  = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Ошибка сохранения'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-3)' }}>
      Загрузка настроек…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Топбар */}
      <div style={{
        height: '52px', flexShrink: 0,
        background: '#fff', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Настройки</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saved && (
            <span style={{ fontSize: '12.5px', color: 'var(--green)', fontWeight: 500 }}>
              ✓ Сохранено
            </span>
          )}
          {error && (
            <span style={{ fontSize: '12.5px', color: 'var(--red)' }}>{error}</span>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <IconSave /> {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="settings-content" style={{ flex: 1, overflowY: 'auto', padding: '24px', width: '100%' }}>

        {/* ── ОСТАТКИ ─────────────────────────────────────────── */}
        <Section title="Пороги остатков" desc="Определяют цвет индикатора на странице складского баланса. Можно переопределить для каждого товара отдельно в его карточке.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label={<Tooltip text="Если остаток ≤ этого значения — индикатор становится жёлтым. Сигнал: пора думать о закупке." label="Жёлтый порог, шт." />}>
              <input className="input input-mono" type="number" min="0"
                value={form.stock_threshold_yellow}
                onChange={e => setField('stock_threshold_yellow', parseInt(e.target.value) || 0)} />
              <Hint>Остаток ≤ {form.stock_threshold_yellow} шт. → жёлтый</Hint>
            </Field>
            <Field label={<Tooltip text="Если остаток ≤ этого значения — индикатор становится красным. Критический уровень." label="Красный порог, шт." />}>
              <input className="input input-mono" type="number" min="0"
                value={form.stock_threshold_red}
                onChange={e => setField('stock_threshold_red', parseInt(e.target.value) || 0)} />
              <Hint>Остаток ≤ {form.stock_threshold_red} шт. → красный</Hint>
            </Field>
          </div>

          {/* Визуализация порогов */}
          <div style={{
            marginTop: '16px', padding: '12px 14px',
            background: 'var(--page)', border: '1px solid var(--line)',
            borderRadius: '4px', fontSize: '12px',
          }}>
            <div style={{ fontWeight: 500, color: 'var(--ink-3)', marginBottom: '10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Пример</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { qty: Math.max(form.stock_threshold_yellow, form.stock_threshold_red) + 5, label: 'В наличии' },
                { qty: Math.max(form.stock_threshold_red + 1, Math.floor((form.stock_threshold_yellow + form.stock_threshold_red) / 2) || form.stock_threshold_yellow), label: 'Мало' },
                { qty: form.stock_threshold_red, label: 'Критично' },
                { qty: 0, label: 'Нет' },
              ].map(ex => {
                const status =
                  ex.qty <= form.stock_threshold_red    ? 'red' :
                  ex.qty <= form.stock_threshold_yellow ? 'yellow' : 'green'
                const colors = { green: 'var(--green)', yellow: 'var(--amber)', red: 'var(--red)' }
                return (
                  <div key={ex.qty} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[status], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: colors[status], width: '40px' }}>{ex.qty} шт.</span>
                    <span style={{ color: 'var(--ink-3)' }}>{ex.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>

        {/* ── НАЦЕНКА ──────────────────────────────────────────── */}
        <Section title="Наценка по умолчанию" desc="Подставляется автоматически при создании новой партии. Можно изменить для каждой партии отдельно.">
          <div style={{ maxWidth: '240px' }}>
            <Field label={<Tooltip text={'Коэффициент умножается на себестоимость:\n1.25 → наценка 25%\n1.50 → наценка 50%\n2.00 → наценка 100%'} label="Коэффициент наценки" />}>
              <input className="input input-mono" type="number" min="1" step="0.01"
                value={form.default_markup}
                onChange={e => setField('default_markup', parseFloat(e.target.value) || 1.25)} />
              <Hint>Наценка {((form.default_markup - 1) * 100).toFixed(0)}% к себестоимости</Hint>
            </Field>
          </div>
        </Section>

        {/* ── АВТО-НУМЕРАЦИЯ ───────────────────────────────────── */}
        <Section title="Авто-нумерация" desc="Система подставляет следующий номер при создании партии или сделки. Можно отредактировать вручную перед сохранением.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

            {/* Партии */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '10px' }}>Партии</div>
              <Field label="Префикс">
                <input className="input input-mono" value={form.batch_number_prefix}
                  onChange={e => setField('batch_number_prefix', e.target.value.toUpperCase())}
                  maxLength={5} autoComplete="off" />
              </Field>
              <Field label={<Tooltip text="Следующая партия получит этот номер. После создания счётчик увеличивается автоматически." label="Следующий номер" />}>
                <input className="input input-mono" type="number" min="1"
                  value={form.batch_number_counter}
                  onChange={e => setField('batch_number_counter', parseInt(e.target.value) || 1)} />
              </Field>
              <Preview value={`${form.batch_number_prefix}-${String(form.batch_number_counter).padStart(3, '0')}`} label="Следующая партия:" />
            </div>

            {/* Сделки */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '10px' }}>Сделки</div>
              <Field label="Префикс">
                <input className="input input-mono" value={form.deal_number_prefix}
                  onChange={e => setField('deal_number_prefix', e.target.value.toUpperCase())}
                  maxLength={5} autoComplete="off" />
              </Field>
              <Field label={<Tooltip text="Следующая сделка получит этот номер. После создания счётчик увеличивается автоматически." label="Следующий номер" />}>
                <input className="input input-mono" type="number" min="1"
                  value={form.deal_number_counter}
                  onChange={e => setField('deal_number_counter', parseInt(e.target.value) || 1)} />
              </Field>
              <Preview value={`${form.deal_number_prefix}-${String(form.deal_number_counter).padStart(3, '0')}`} label="Следующая сделка:" />
            </div>
          </div>
        </Section>

        {/* ── РЕКВИЗИТЫ ────────────────────────────────────────── */}
        <Section title="Реквизиты компании" desc="Используются при формировании документов. Можно заполнить позже.">
          <Field label="Наименование организации">
            <input className="input" value={form.company_name}
              onChange={e => setField('company_name', e.target.value)}
              placeholder="ООО AUTEKO" autoComplete="off" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="ИНН">
              <input className="input input-mono" value={form.company_inn}
                onChange={e => setField('company_inn', e.target.value)}
                placeholder="7712345678" maxLength={12} autoComplete="off" />
            </Field>
          </div>
          <Field label="Адрес">
            <textarea className="input" value={form.company_address}
              onChange={e => setField('company_address', e.target.value)}
              placeholder="г. Москва, ул. Примерная, д. 1"
              rows={2} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              autoComplete="off" />
          </Field>
        </Section>

      </div>
    </div>
  )
}

// ── Вспомогательные компоненты ───────────────────────────────
function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-3)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{
        background: '#fff', border: '1px solid var(--line)',
        borderRadius: '6px', padding: '16px 20px',
      }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--ink-3)', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '4px' }}>{children}</div>
  )
}

function Preview({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px 8px', flexWrap: 'wrap',
      padding: '8px 10px', background: 'var(--blue-bg)',
      border: '1px solid var(--line)', borderRadius: '4px',
      marginTop: '4px',
    }}>
      <span style={{ fontSize: '11.5px', color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '14px', color: 'var(--blue-2)' }}>{value}</span>
    </div>
  )
}
