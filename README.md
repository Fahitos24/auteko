# AUTEKO — Информационная система

## Стек
- **Next.js 14** (App Router)
- **PostgreSQL** (база данных)
- **TypeScript**
- **Tailwind CSS**

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка окружения
```bash
cp .env.example .env.local
# Заполни DATABASE_URL и JWT_SECRET
```

### 3. Создание базы данных
```bash
# Подключись к PostgreSQL и выполни:
psql -U postgres -c "CREATE DATABASE auteko_db;"
psql -U postgres -c "CREATE USER auteko_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE auteko_db TO auteko_user;"

# Примени схему:
psql -U auteko_user -d auteko_db -f auteko_schema.sql
```

### 4. Создание первого пользователя
```bash
node scripts/create-user.js admin@auteko.ru yourpassword "Имя Фамилия"
```

### 5. Запуск
```bash
npm run dev        # разработка → http://localhost:3000
npm run build      # сборка для продакшена
npm run start      # продакшен
```

## Деплой на Selectel VPS

```bash
# На сервере:
git clone <repo>
cd auteko
npm install
npm run build

# Через PM2:
pm2 start npm --name "auteko" -- start
pm2 startup
pm2 save
```

## Структура проекта

```
src/
├── app/
│   ├── (app)/          # Защищённые страницы (требуют авторизации)
│   │   ├── products/   # Номенклатура
│   │   ├── batches/    # Партии
│   │   ├── deals/      # Сделки
│   │   ├── clients/    # Контрагенты
│   │   └── stock/      # Остатки
│   ├── api/            # API маршруты
│   └── login/          # Страница входа
├── components/
│   ├── layout/         # Сайдбар, мобильная навигация
│   ├── ui/             # Переиспользуемые компоненты
│   └── forms/          # Формы
├── lib/
│   ├── db.ts           # Подключение к PostgreSQL
│   └── auth.ts         # JWT авторизация
└── types/
    └── index.ts        # TypeScript типы
```
