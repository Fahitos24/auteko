'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href: '/products', label: 'Товары',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>,
  },
  {
    href: '/batches', label: 'Партии',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  },
  {
    href: '/deals', label: 'Сделки',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  },
  {
    href: '/stock', label: 'Остатки',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: '/clients', label: 'Клиенты',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  },
  {
    href: '/settings', label: 'Настройки',
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobile-nav" style={{
      display: 'none',
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff',
      borderTop: '1px solid var(--line)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 50,
      justifyContent: 'space-around',
      height: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))',
    }}>
      {NAV.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '3px',
            padding: '8px 0',
            fontSize: '10px', fontWeight: 500,
            minWidth: 0, whiteSpace: 'nowrap',
            color: active ? 'var(--blue)' : 'var(--ink-3)',
            textDecoration: 'none',
            flex: 1,
          }}>
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
