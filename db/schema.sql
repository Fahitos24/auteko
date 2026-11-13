-- ============================================================================
-- Auteko: ПУСТАЯ база данных — все таблицы и поля, без данных
-- Выгружено из живой БД (pg_dump --schema-only) 13.11.2026, PostgreSQL 18
--
-- Сценарий: «создать с нуля чистую БД со всей структурой».
-- Данных в таблицах нет, только служебные настройки по умолчанию
-- (пороги остатков, префиксы и счётчики номеров) — без них приложение не работает.
--
-- Применение на чистом сервере:
--   sudo -u postgres psql -c "CREATE DATABASE auteko_db;"
--   sudo -u postgres psql -d auteko_db -f db/schema.sql
--   sudo -u postgres psql -d auteko_db -f db/roles.sql   -- роль приложения
--
-- НЕ запускать на БД, где уже есть данные: таблицы создаются заново.
-- ============================================================================

-- ─── Расширение ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;  -- gen_random_uuid()

-- ─── Функции ────────────────────────────────────────────────────────────────

-- Автообновление updated_at
CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Триггер расчёта цены партии (вызывается при INSERT/UPDATE в batches)
CREATE FUNCTION public.calc_batch_prices() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- С/С за ед. = (EXW в юанях × курс) × (1 + пошлина%) + (доставка + прочее) / кол-во
    NEW.cost_price_rub := ROUND(
        (NEW.price_exw_cny * NEW.cny_rate) * (1 + NEW.customs_duty_pct / 100.0)
        + (NEW.transport_cost + NEW.other_costs) / NEW.quantity,
        2
    );
    -- Цена КП = С/С × коэффициент наценки
    NEW.price_kp_rub := ROUND(NEW.cost_price_rub * NEW.markup_coefficient, 2);
    -- Прибыль = Цена КП - С/С
    NEW.profit_per_unit := ROUND(NEW.price_kp_rub - NEW.cost_price_rub, 2);
    RETURN NEW;
END;
$$;

-- Генератор номеров (партий/сделок) через счётчик в settings
CREATE FUNCTION public.next_number(prefix_key text, counter_key text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  prefix  TEXT;
  counter INT;
  result  TEXT;
BEGIN
  SELECT value INTO prefix  FROM settings WHERE key = prefix_key;
  SELECT value::int INTO counter FROM settings WHERE key = counter_key;

  result := prefix || '-' || LPAD(counter::TEXT, 3, '0');

  UPDATE settings
  SET value = (counter + 1)::TEXT, updated_at = NOW()
  WHERE key = counter_key;

  RETURN result;
END;
$$;

-- ─── Таблицы ────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
    id             uuid DEFAULT gen_random_uuid() NOT NULL,
    email          character varying(255) NOT NULL,
    password_hash  character varying(255) NOT NULL,
    full_name      character varying(255),
    token_version  integer DEFAULT 0 NOT NULL,      -- растёт при выходе/смене пароля → отзыв сессий
    is_active      boolean DEFAULT true NOT NULL,   -- отключение пользователя
    created_at     timestamptz DEFAULT now() NOT NULL,
    updated_at     timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT users_pkey   PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE public.products (
    id                    uuid DEFAULT gen_random_uuid() NOT NULL,
    auteko_article        character varying(100) NOT NULL,     -- артикул Аутеко (уникальный)
    original_articles     text[],                              -- артикулы поставщика
    name                  character varying(500) NOT NULL,
    engine_models         text[],                              -- применимость к двигателям
    tnved_code            character(10),                       -- код ТН ВЭД
    production_days_min   integer,
    production_days_max   integer,
    is_available          boolean DEFAULT true NOT NULL,
    status                character varying(20) DEFAULT 'active' NOT NULL,
    notes                 text,
    stock_threshold_yellow integer,                             -- порог жёлтого остатка (NULL = глобальный)
    stock_threshold_red    integer,                             -- порог красного остатка (NULL = глобальный)
    created_at            timestamptz DEFAULT now() NOT NULL,
    updated_at            timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_auteko_article_key UNIQUE (auteko_article),
    CONSTRAINT products_status_check CHECK (status = ANY (ARRAY['active', 'archived']))
);

CREATE TABLE public.clients (
    id             uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name   character varying(500) NOT NULL,
    inn            character varying(20),               -- 10 цифр юрлицо / 12 ИП
    contact_person character varying(255),
    phone          character varying(50),
    email          character varying(255),
    notes          text,
    created_at     timestamptz DEFAULT now() NOT NULL,
    updated_at     timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT clients_pkey PRIMARY KEY (id)
);

CREATE TABLE public.batches (
    id                 uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_number       character varying(50) NOT NULL,    -- P-001 и т.п.
    product_id         uuid NOT NULL,
    quantity           integer NOT NULL,                  -- поставлено единиц
    price_exw_cny      numeric(12,2) NOT NULL,            -- цена EXW в юанях
    cny_rate           numeric(10,4) NOT NULL,            -- курс юаня
    cny_rate_date      date NOT NULL,
    customs_duty_pct   numeric(5,2) DEFAULT 0 NOT NULL,   -- пошлина %
    transport_cost     numeric(12,2) DEFAULT 0 NOT NULL,  -- доставка руб. на партию
    other_costs        numeric(12,2) DEFAULT 0 NOT NULL,  -- прочее руб. на партию
    cost_price_rub     numeric(12,2),                     -- С/С за ед. — считает триггер
    markup_coefficient numeric(5,3) DEFAULT 1.25 NOT NULL,
    price_kp_rub       numeric(12,2),                     -- цена КП — считает триггер
    profit_per_unit    numeric(12,2),                     -- прибыль/ед. — считает триггер
    gtd_number         character varying(100),
    gtd_date           date,
    created_at         timestamptz DEFAULT now() NOT NULL,
    updated_at         timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT batches_pkey PRIMARY KEY (id),
    CONSTRAINT batches_batch_number_key UNIQUE (batch_number),
    CONSTRAINT batches_quantity_check CHECK (quantity > 0)
);

CREATE TABLE public.deals (
    id                    uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_number           character varying(50) NOT NULL,   -- R-001 и т.п.
    client_id             uuid NOT NULL,
    product_id            uuid NOT NULL,
    batch_id              uuid NOT NULL,
    contract_number       character varying(100),
    spec_number           character varying(100),
    quantity              integer NOT NULL,
    price_with_vat        numeric(12,2) NOT NULL,           -- цена с НДС за ед.
    total_amount          numeric(14,2) GENERATED ALWAYS AS (quantity * price_with_vat) STORED,
    delivery_deadline     date,                             -- плановый срок поставки
    prepayment_date       date,                             -- фактическая предоплата
    actual_delivery_date  date,
    actual_payment_date   date,
    upd_number            character varying(100),
    upd_date              date,
    status                character varying(20) DEFAULT 'new' NOT NULL,
    notes                 text,
    created_at            timestamptz DEFAULT now() NOT NULL,
    updated_at            timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT deals_pkey PRIMARY KEY (id),
    CONSTRAINT deals_deal_number_key UNIQUE (deal_number),
    CONSTRAINT deals_quantity_check CHECK (quantity > 0),
    CONSTRAINT deals_status_check CHECK (status = ANY (ARRAY['new', 'confirmed', 'shipped', 'done', 'cancelled']))
);

CREATE TABLE public.settings (
    key        character varying(100) NOT NULL,
    value      text NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT settings_pkey PRIMARY KEY (key)
);

-- ─── Служебные настройки по умолчанию (данных в таблицах при этом нет) ───────
-- Пороги остатков, префиксы и счётчики номеров. Без них приложение не стартует.

INSERT INTO public.settings (key, value) VALUES
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

-- ─── Внешние ключи (ON DELETE RESTRICT: сначала удалить связанные записи) ───

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_client_id_fkey  FOREIGN KEY (client_id)  REFERENCES public.clients(id)  ON DELETE RESTRICT;

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_batch_id_fkey   FOREIGN KEY (batch_id)   REFERENCES public.batches(id)  ON DELETE RESTRICT;

-- ─── Индексы ────────────────────────────────────────────────────────────────

CREATE INDEX idx_products_auteko_article     ON public.products USING btree (auteko_article);
CREATE INDEX idx_products_engine_models      ON public.products USING gin (engine_models);
CREATE INDEX idx_products_original_articles  ON public.products USING gin (original_articles);

CREATE INDEX idx_batches_batch_number        ON public.batches USING btree (batch_number);
CREATE INDEX idx_batches_product_id          ON public.batches USING btree (product_id);

CREATE INDEX idx_deals_client_id             ON public.deals USING btree (client_id);
CREATE INDEX idx_deals_product_id            ON public.deals USING btree (product_id);
CREATE INDEX idx_deals_batch_id              ON public.deals USING btree (batch_id);
CREATE INDEX idx_deals_status                ON public.deals USING btree (status);

CREATE UNIQUE INDEX uq_deals_deal_number        ON public.deals    (deal_number);
CREATE UNIQUE INDEX uq_batches_batch_number     ON public.batches  (batch_number);
CREATE UNIQUE INDEX uq_products_auteko_article  ON public.products (auteko_article);

-- ─── Триггеры ───────────────────────────────────────────────────────────────

CREATE TRIGGER trg_users_updated_at     BEFORE UPDATE ON public.users    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_products_updated_at  BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_clients_updated_at   BEFORE UPDATE ON public.clients  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_batches_updated_at   BEFORE UPDATE ON public.batches  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_deals_updated_at     BEFORE UPDATE ON public.deals    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_calc_batch_prices     BEFORE INSERT OR UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.calc_batch_prices();

-- ─── Представление: остатки по партиям (жёлтый/красный/зелёный) ─────────────
-- Остаток = количество в партии − продано (сделки в статусе не-cancelled).
-- Пороги: сначала свои пороги товара, иначе глобальные из settings.

CREATE VIEW public.stock_balance AS
 WITH thresholds AS (
         SELECT ( SELECT (settings.value)::integer AS value
                   FROM public.settings
                  WHERE ((settings.key)::text = 'stock_threshold_yellow'::text)) AS global_yellow,
            ( SELECT (settings.value)::integer AS value
                   FROM public.settings
                  WHERE ((settings.key)::text = 'stock_threshold_red'::text)) AS global_red
        )
 SELECT p.id AS product_id,
    p.auteko_article,
    p.name,
    p.engine_models,
    b.id AS batch_id,
    b.batch_number,
    b.quantity AS received,
    b.price_kp_rub,
    b.cost_price_rub,
    COALESCE(sold.total_sold, (0)::bigint) AS sold,
    (b.quantity - COALESCE(sold.total_sold, (0)::bigint)) AS balance,
    COALESCE(p.stock_threshold_yellow, t.global_yellow) AS threshold_yellow,
    COALESCE(p.stock_threshold_red, t.global_red) AS threshold_red,
        CASE
            WHEN ((b.quantity - COALESCE(sold.total_sold, (0)::bigint)) <= COALESCE(p.stock_threshold_red, t.global_red)) THEN 'red'::text
            WHEN ((b.quantity - COALESCE(sold.total_sold, (0)::bigint)) <= COALESCE(p.stock_threshold_yellow, t.global_yellow)) THEN 'yellow'::text
            ELSE 'green'::text
        END AS stock_status
   FROM (((public.products p
     CROSS JOIN thresholds t)
     JOIN public.batches b ON ((b.product_id = p.id)))
     LEFT JOIN ( SELECT deals.batch_id,
            sum(deals.quantity) AS total_sold
           FROM public.deals
          WHERE ((deals.status)::text <> 'cancelled'::text)
          GROUP BY deals.batch_id) sold ON ((sold.batch_id = b.id)))
  WHERE ((p.status)::text = 'active'::text)
  ORDER BY p.name, b.batch_number;
