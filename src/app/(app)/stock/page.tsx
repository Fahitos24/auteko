'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StockBalance } from '@/types'
import Tooltip from '@/components/ui/Tooltip'

const IconSearch   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IconDownload = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IconRefresh  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>

function fmtRub(n: unknown) {
  const num = Number(n)
  if (!n && n !== 0) return '—'
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num) + ' ₽'
}

const STOCK_STATUS = {
  green:  { label: 'В наличии', color: 'var(--green)', bg: 'var(--green-bg)' },
  yellow: { label: 'Мало',      color: 'var(--amber)', bg: 'var(--amber-bg)' },
  red:    { label: 'Нет',       color: 'var(--red)',   bg: 'var(--red-bg)'   },
} as const
type StockStatus = keyof typeof STOCK_STATUS

interface Summary { green: number; yellow: number; red: number; total_value: number }

export default function StockPage() {
  const [rows, setRows]       = useState<StockBalance[]>([])
  const [total, setTotal]     = useState(0)
  const [summary, setSummary] = useState<Summary>({ green: 0, yellow: 0, red: 0, total_value: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p   = new URLSearchParams({ search, status: statusFilter, limit: '500' })
      const res = await fetch(`/api/stock?${p}`)
      const json = await res.json()
      setRows(json.data || [])
      setTotal(json.total || 0)
      if (json.summary) setSummary(json.summary)
    } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  async function exportExcel() {
    const res  = await fetch('/api/stock/export')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `stock_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Топбар */}
      <div className="page-topbar" style={{ height: '52px', flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap' }}>Складской баланс</span>

        <div className="topbar-stats" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px', borderRight: '1px solid var(--line)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 500 }}>{total}</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>позиций</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', padding: '0 14px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 500, color: 'var(--blue-2)' }}>{fmtRub(summary.total_value)}</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>стоимость КП</span>
          </div>

          {/* Индикаторы */}
          <div className="stock-indicators" style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
            {(Object.entries(STOCK_STATUS) as [StockStatus, typeof STOCK_STATUS[StockStatus]][]).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '4px', background: cfg.bg, fontSize: '12px', fontWeight: 500, color: cfg.color }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                {cfg.label}: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{key === 'green' ? summary.green : key === 'yellow' ? summary.yellow : summary.red}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={load} title="Обновить"><IconRefresh /></button>
          <button className="btn btn-outline btn-sm" onClick={exportExcel}><IconDownload /> <span>Экспорт</span></button>
        </div>
      </div>

      {/* Сводка для телефона (на десктопе скрыта, там индикаторы в топбаре) */}
      <div className="stock-mobile-summary" style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 12px', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        {(Object.entries(STOCK_STATUS) as [StockStatus, typeof STOCK_STATUS[StockStatus]][]).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', background: cfg.bg, fontSize: '11px', fontWeight: 500, color: cfg.color }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            {cfg.label}: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{summary[key]}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ink-3)' }}>{total} поз.</span>
      </div>

      {/* Фильтры */}
      <div className="page-filters" style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '140px' }}>
          <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}><IconSearch /></span>
          <input className="input" style={{ paddingLeft: '30px', fontSize: '13px' }}
            placeholder="Поиск по артикулу, наименованию…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Фильтр по статусу — скролл на мобиле */}
        <div className="status-filter-row" style={{ display: 'flex', gap: '4px' }}>
          {([['all', 'Все'], ['green', 'В наличии'], ['yellow', 'Мало'], ['red', 'Нет']] as const).map(([key, label]) => {
            const active = statusFilter === key
            const cfg    = key !== 'all' ? STOCK_STATUS[key] : null
            return (
              <button key={key} onClick={() => setStatusFilter(key)} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? (cfg ? cfg.color : 'var(--ink)') : 'transparent', color: active ? '#fff' : 'var(--ink-3)', transition: '.12s' }}>
                {label}
              </button>
            )
          })}
        </div>

        <div className="stock-legend-row" style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--ink-3)', display: 'flex', gap: '12px', flexShrink: 0 }}>
          <span>Зелёный — более 5 шт.</span>
          <span>Жёлтый — менее 5 шт.</span>
          <span>Красный — 0 шт.</span>
        </div>
      </div>

      {/* Таблица */}
      <div className="table-area" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <table className="data-table" style={{ minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={{ width: '4px', padding: 0 }}></th>
              <th style={{ width: '130px' }}>Арт. AUTEKO</th>
              <th>Наименование</th>
              <th style={{ width: '110px' }}><Tooltip text="Номер закупочной партии." label="№ партии" /></th>
              <th style={{ width: '85px' }}><Tooltip text="Общее кол-во поступивших единиц." label="Поступило" /></th>
              <th style={{ width: '85px' }}><Tooltip text="Продано по активным сделкам." label="Продано" /></th>
              <th style={{ width: '85px' }}><Tooltip text="Текущий остаток = Поступило − Продано." label="Остаток" /></th>
              <th style={{ width: '115px' }}><Tooltip text="Себестоимость единицы из партии." label="С/С руб./ед." /></th>
              <th style={{ width: '115px' }}><Tooltip text="Цена КП за единицу из этой партии." label="Цена КП" /></th>
              <th style={{ width: '140px' }}><Tooltip text="Остаток × Цена КП." label="Стоимость остатка" /></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}><div className="empty-state"><div className="empty-sub">Загрузка…</div></div></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10}>
                <div className="empty-state">
                  <div className="empty-title">{search ? 'Ничего не найдено' : 'Нет данных'}</div>
                  <div className="empty-sub">{!search && 'Добавьте партии чтобы увидеть остатки'}</div>
                </div>
              </td></tr>
            ) : rows.map((row, i) => {
              const status = row.stock_status as StockStatus
              const cfg    = STOCK_STATUS[status]
              const value  = Number(row.balance) * Number(row.price_kp_rub)
              return (
                <tr key={`${row.product_id}-${row.batch_id}-${i}`} style={{ background: status === 'red' ? '#fff8f8' : undefined }}>
                  <td style={{ padding: 0, width: '4px' }}>
                    <div style={{ width: '4px', height: '38px', background: cfg.color }} />
                  </td>
                  <td><span className="cell-article">{row.auteko_article}</span></td>
                  <td><span className="cell-name">{row.name}</span></td>
                  <td><span className="cell-mono">{row.batch_number}</span></td>
                  <td><span className="cell-num">{row.received}</span></td>
                  <td><span className="cell-num">{row.sold}</span></td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: cfg.color }}>{Number(row.balance)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-3)', marginLeft: '3px' }}>шт.</span>
                  </td>
                  <td><span className="cell-num">{fmtRub(row.cost_price_rub)}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--blue-2)' }}>{fmtRub(row.price_kp_rub)}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: Number(row.balance) > 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{Number(row.balance) > 0 ? fmtRub(value) : '—'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>

      </div>

      {/* Итоги — вне прокручиваемой области, всегда по ширине экрана */}
      {rows.length > 0 && !loading && (
        <div className="stock-footer" style={{ flexShrink: 0, padding: '12px 16px', background: '#fff', borderTop: '2px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '13px', color: 'var(--ink-3)', flexWrap: 'wrap' }}>
          <span>В наличии: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)' }}>{rows.filter(r => Number(r.balance) > 0).length} поз.</span></span>
          <span>Остаток: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)' }}>{rows.reduce((s, r) => s + Number(r.balance), 0)} шт.</span></span>
          <span>Стоимость КП: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue-2)' }}>{fmtRub(summary.total_value)}</span></span>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .topbar-stats { display: none !important; }
          .stock-legend-row { display: none !important; }
          .stock-indicators { flex-wrap: wrap !important; gap: 4px !important; }
          .stock-indicators > div { font-size: 11px !important; padding: 2px 7px !important; }
          .status-filter-row { overflow-x: auto; flex-wrap: nowrap !important; scrollbar-width: none; }
          .status-filter-row::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  )
}
