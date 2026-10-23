'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка входа'); return }
      router.push('/products')
      router.refresh()
    } catch {
      setError('Не удалось подключиться к серверу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--page)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>

        {/* Логотип */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '44px', height: '44px',
            border: '2px solid var(--blue)',
            borderRadius: '6px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 600, color: 'var(--blue)',
            letterSpacing: '-.5px', marginBottom: '14px',
          }}>AU</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>AUTEKO</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-3)' }}>Войдите в систему</div>
        </div>

        {/* Форма */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          padding: '20px',
        }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@auteko.ru" required autoComplete="email" />
            </div>
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Пароль</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>

            {error && (
              <div className="notice notice-error" style={{ marginBottom: '12px', marginTop: 0 }}>{error}</div>
            )}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
