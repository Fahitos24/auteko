-- =============================================
-- Миграция: таблица настроек + обновление VIEW
-- Выполнить один раз в psql
-- =============================================

-- 1. Таблица настроек
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Значения по умолчанию
INSERT INTO settings (key, value) VALUES
  ('stock_threshold_yellow',  '5'),
  ('stock_threshold_red',     '1'),
  ('default_markup',          '1.25'),
  ('batch_number_prefix',     'P'),
  ('batch_number_counter',    '1'),
  ('deal_number_prefix',      'R'),
  ('deal_number_counter',     '1'),
  ('company_name',            ''),
  ('company_inn',             ''),
  ('company_address',         '')
ON CONFLICT (key) DO NOTHING;

-- 3. Новые поля в products для индивидуальных порогов
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_threshold_yellow INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stock_threshold_red    INT DEFAULT NULL;

-- 4. Обновлённый VIEW — пороги берутся из товара, иначе из настроек
CREATE OR REPLACE VIEW stock_balance AS
WITH thresholds AS (
  SELECT
    (SELECT value::int FROM settings WHERE key = 'stock_threshold_yellow') AS global_yellow,
    (SELECT value::int FROM settings WHERE key = 'stock_threshold_red')    AS global_red
)
SELECT
  p.id                                            AS product_id,
  p.auteko_article,
  p.name,
  p.engine_models,
  b.id                                            AS batch_id,
  b.batch_number,
  b.quantity                                      AS received,
  b.price_kp_rub,
  b.cost_price_rub,
  COALESCE(sold.total_sold, 0)                    AS sold,
  b.quantity - COALESCE(sold.total_sold, 0)       AS balance,
  COALESCE(p.stock_threshold_yellow, t.global_yellow) AS threshold_yellow,
  COALESCE(p.stock_threshold_red,    t.global_red)    AS threshold_red,
  CASE
    WHEN b.quantity - COALESCE(sold.total_sold, 0)
         <= COALESCE(p.stock_threshold_red,    t.global_red)    THEN 'red'
    WHEN b.quantity - COALESCE(sold.total_sold, 0)
         <= COALESCE(p.stock_threshold_yellow, t.global_yellow) THEN 'yellow'
    ELSE 'green'
  END AS stock_status
FROM products p
CROSS JOIN thresholds t
JOIN batches b ON b.product_id = p.id
LEFT JOIN (
  SELECT batch_id, SUM(quantity) AS total_sold
  FROM deals
  WHERE status != 'cancelled'
  GROUP BY batch_id
) sold ON sold.batch_id = b.id
WHERE p.status = 'active'
ORDER BY p.name, b.batch_number;

-- 5. Функция авто-нумерации
CREATE OR REPLACE FUNCTION next_number(prefix_key TEXT, counter_key TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix  TEXT;
  counter INT;
  result  TEXT;
BEGIN
  SELECT value INTO prefix  FROM settings WHERE key = prefix_key;
  SELECT value::int INTO counter FROM settings WHERE key = counter_key;

  result := prefix || '-' || LPAD(counter::TEXT, 3, '0');

  UPDATE settings SET value = (counter + 1)::TEXT, updated_at = NOW()
  WHERE key = counter_key;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
