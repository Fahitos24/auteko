-- 001_security.sql: безопасность (отзыв сессий, уникальность номеров)
-- Применять: psql "$DATABASE_URL" -f db/migrations/001_security.sql
-- ВАЖНО: перед созданием UNIQUE-индексов убедитесь, что дублей нет, иначе миграция упадёт:
--   SELECT deal_number, COUNT(*) FROM deals GROUP BY 1 HAVING COUNT(*) > 1;

BEGIN;

-- Отзыв сессий: token_version растёт при выходе и смене пароля; is_active отключает пользователя
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Уникальность номеров (приложение обрабатывает ошибку 23505 как 409)
CREATE UNIQUE INDEX IF NOT EXISTS uq_deals_deal_number      ON deals    (deal_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batches_batch_number   ON batches  (batch_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_auteko_article ON products (auteko_article);

COMMIT;
