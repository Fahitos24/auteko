import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
    }}>
      {/* Десктоп: боковая панель */}
      <div className="desktop-sidebar">
        <Sidebar />
      </div>

      {/* Основной контент */}
      <main style={{
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {children}
      </main>

      {/* Мобильная навигация */}
      <MobileNav />

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
