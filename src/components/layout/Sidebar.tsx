'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  {
    href: '/products', label: 'Товары',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
        <path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
      </svg>
    ),
  },
  {
    href: '/batches', label: 'Партии',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    href: '/deals', label: 'Сделки',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
  {
    href: '/clients', label: 'Клиенты',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      </svg>
    ),
  },
  {
    href: '/stock', label: 'Остатки',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: '/settings', label: 'Настройки',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside style={{
      width: '160px',
      flexShrink: 0,
      background: '#1B3A6B',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Логотип */}
      <div style={{
        height: '52px',
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
        gap: '10px',
      }}>
        <div style={{
          width: '26px', height: '26px',
          border: '2px solid rgba(255,255,255,0.85)',
          borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 700, color: '#fff',
          letterSpacing: '-.5px', flexShrink: 0,
        }}>AU</div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', letterSpacing: '.02em' }}>AUTEKO</span>
      </div>

      {/* Навигация */}
      <nav style={{ flex: 1, padding: '8px 0', overflow: 'hidden' }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '0 16px', height: '40px',
              color: active ? '#fff' : 'rgba(255,255,255,0.5)',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: active ? '2px solid #fff' : '2px solid transparent',
              textDecoration: 'none',
              fontSize: '12.5px', fontWeight: active ? 500 : 400,
              transition: 'color .15s, background .15s',
            }}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Выход */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '8px 0' }}>
        <button onClick={logout} style={{
          width: '100%', height: '40px',
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 16px',
          color: 'rgba(255,255,255,0.4)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: '12.5px', fontWeight: 400,
          transition: 'color .15s',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Выход
        </button>
      </div>
    </aside>
  )
}
