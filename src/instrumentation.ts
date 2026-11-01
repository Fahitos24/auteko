// Выполняется один раз при старте сервера Next.js.
// Если JWT_SECRET слабый или не задан, процесс завершается (а не падает на первом запросе).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateSecret } = await import('./lib/jwt')
    try {
      validateSecret()
    } catch (e) {
      console.error('FATAL:', (e as Error).message)
      process.exit(1)
    }
  }
}
