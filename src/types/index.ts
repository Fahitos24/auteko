// =============================================
// AUTEKO — TypeScript типы
// =============================================

export interface User {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface Product {
  id: string
  auteko_article: string
  original_articles: string[]
  name: string
  engine_models: string[]
  tnved_code: string | null
  production_days_min: number | null
  production_days_max: number | null
  is_available: boolean
  notes: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface Batch {
  id: string
  batch_number: string
  product_id: string
  quantity: number
  price_exw_cny: number       // цена в юанях за ед.
  cny_rate: number            // курс юаня
  cny_rate_date: string       // дата фиксации курса
  customs_duty_pct: number    // пошлина %
  transport_cost: number      // доставка руб. на всю партию
  other_costs: number         // прочие руб. на всю партию
  cost_price_rub: number      // С/С руб. за ед. (авторасчёт)
  markup_coefficient: number  // коэф. наценки (1.25 = +25%)
  price_kp_rub: number        // цена КП руб. за ед. (авторасчёт)
  profit_per_unit: number     // прибыль руб. за ед. (авторасчёт)
  gtd_number: string | null
  gtd_date: string | null
  created_at: string
  updated_at: string
  // JOIN поля
  product_name?: string
  product_article?: string
}

export interface Client {
  id: string
  company_name: string
  inn: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DealStatus = 'new' | 'confirmed' | 'shipped' | 'done' | 'cancelled'

export interface Deal {
  id: string
  deal_number: string
  client_id: string
  product_id: string
  batch_id: string
  contract_number: string | null
  spec_number: string | null
  quantity: number
  price_with_vat: number
  total_amount: number        // авторасчёт: quantity × price_with_vat
  delivery_deadline: string | null
  prepayment_date: string | null
  actual_delivery_date: string | null
  actual_payment_date: string | null
  upd_number: string | null
  upd_date: string | null
  status: DealStatus
  notes: string | null
  created_at: string
  updated_at: string
  // JOIN поля
  client_name?: string
  product_name?: string
  product_article?: string
  batch_number?: string
}

export interface StockBalance {
  product_id: string
  auteko_article: string
  name: string
  engine_models: string[]
  batch_id: string
  batch_number: string
  received: number
  price_kp_rub: number
  cost_price_rub: number
  sold: number
  balance: number
  stock_status: 'green' | 'yellow' | 'red'
}

// Для форм
export type ProductFormData = Omit<Product, 'id' | 'created_at' | 'updated_at'>
export type BatchFormData   = Omit<Batch,   'id' | 'created_at' | 'updated_at' | 'cost_price_rub' | 'price_kp_rub' | 'profit_per_unit' | 'product_name' | 'product_article'>
export type ClientFormData  = Omit<Client,  'id' | 'created_at' | 'updated_at'>
export type DealFormData    = Omit<Deal,    'id' | 'created_at' | 'updated_at' | 'total_amount' | 'client_name' | 'product_name' | 'product_article' | 'batch_number'>

// API ответы
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Пагинация
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
