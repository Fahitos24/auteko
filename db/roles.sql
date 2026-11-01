-- Роль приложения с минимальными правами (вместо суперпользователя postgres).
-- Выполнить под владельцем схемы/суперпользователем, ОДИН раз. Замените пароль на длинный случайный.
--   psql -U postgres -d auteko -f db/roles.sql
-- Затем в .env.local:
--   DATABASE_URL=postgresql://auteko_app:<пароль>@localhost:5432/auteko

CREATE ROLE auteko_app LOGIN PASSWORD 'CHANGE_ME_LONG_RANDOM' NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE auteko TO auteko_app;
GRANT USAGE ON SCHEMA public TO auteko_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO auteko_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO auteko_app;

-- Для таблиц, созданных позже миграциями
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auteko_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO auteko_app;
