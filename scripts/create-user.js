#!/usr/bin/env node
// Создание пользователя.
// Пароль НЕ передаётся аргументом (попадает в историю shell и ps).
// Варианты:
//   node scripts/create-user.js email@example.com "Имя Фамилия"          (пароль вводится скрытно)
//   AUTEKO_PASSWORD='...' node scripts/create-user.js email "Имя"          (из переменной окружения)
//   добавить --reset, чтобы сменить пароль существующего пользователя

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const readline = require('readline')
require('dotenv').config({ path: '.env.local' })

const args = process.argv.slice(2)
const reset = args.includes('--reset')
const [email, fullName] = args.filter(a => a !== '--reset')

const MIN_LEN = 12
const BCRYPT_COST = 12

if (!email) {
  console.error('Использование: node scripts/create-user.js email ["Имя"] [--reset]')
  process.exit(1)
}

function askHidden(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = s => { if (s.includes(prompt)) rl.output.write(s) }
    rl.question(prompt, answer => { rl.close(); process.stdout.write('\n'); resolve(answer) })
  })
}

async function main() {
  let password = process.env.AUTEKO_PASSWORD
  if (!password) password = await askHidden('Пароль: ')
  if (!password || password.length < MIN_LEN) {
    console.error(`Пароль должен быть не короче ${MIN_LEN} символов`)
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST)
    const mail = email.toLowerCase()
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [mail])

    if (exists.rowCount && !reset) {
      console.error(`Пользователь ${mail} уже существует. Для смены пароля добавьте --reset`)
      process.exit(1)
    }

    if (exists.rowCount) {
      try {
        // token_version + 1: все старые сессии пользователя перестают работать
        await pool.query(
          'UPDATE users SET password_hash = $2, full_name = COALESCE($3, full_name), token_version = token_version + 1 WHERE email = $1',
          [mail, hash, fullName || null]
        )
      } catch (e) {
        if (e.code !== '42703') throw e
        console.warn('Колонки token_version нет: примените db/migrations/001_security.sql')
        await pool.query(
          'UPDATE users SET password_hash = $2, full_name = COALESCE($3, full_name) WHERE email = $1',
          [mail, hash, fullName || null]
        )
      }
      console.log(`✅ Пароль пользователя ${mail} обновлён`)
    } else {
      await pool.query(
        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
        [mail, hash, fullName || null]
      )
      console.log(`✅ Пользователь ${mail} создан`)
    }
  } catch (err) {
    console.error('Ошибка:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
