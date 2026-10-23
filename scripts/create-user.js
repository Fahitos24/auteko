#!/usr/bin/env node
// Создание первого пользователя
// Запуск: node scripts/create-user.js email@example.com password123 "Имя Фамилия"

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const [,, email, password, fullName] = process.argv

if (!email || !password) {
  console.error('Использование: node scripts/create-user.js email password "Имя"')
  process.exit(1)
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const hash = await bcrypt.hash(password, 10)

    await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3`,
      [email.toLowerCase(), hash, fullName || null]
    )

    console.log(`✅ Пользователь ${email} создан`)
  } catch (err) {
    console.error('Ошибка:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
