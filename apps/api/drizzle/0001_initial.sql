CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'learner',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(12) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  country varchar(80) NOT NULL,
  currency varchar(8) NOT NULL
);
CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid REFERENCES exchanges(id),
  symbol varchar(24) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  sector varchar(100) NOT NULL,
  description text NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'KES',
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS price_bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id),
  period varchar(12) NOT NULL DEFAULT '1d',
  market_date timestamptz NOT NULL,
  open numeric(18,4) NOT NULL,
  high numeric(18,4) NOT NULL,
  low numeric(18,4) NOT NULL,
  close numeric(18,4) NOT NULL,
  volume numeric(24,2) NOT NULL DEFAULT 0,
  source varchar(120) NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  delay_minutes integer,
  external_display_allowed boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'demo',
  CONSTRAINT price_bars_instrument_period_date_uq UNIQUE (instrument_id, period, market_date)
);
CREATE INDEX IF NOT EXISTS price_bars_instrument_date_idx ON price_bars(instrument_id, market_date);
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(140) NOT NULL UNIQUE,
  title varchar(180) NOT NULL,
  description text NOT NULL,
  category varchar(100) NOT NULL,
  level varchar(40) NOT NULL,
  duration varchar(40) NOT NULL,
  lessons_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug varchar(140) NOT NULL,
  title varchar(180) NOT NULL,
  body text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 8,
  CONSTRAINT lessons_course_slug_uq UNIQUE (course_id, slug)
);
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(180) NOT NULL,
  description text NOT NULL,
  category varchar(100) NOT NULL,
  file_url text NOT NULL,
  file_type varchar(30) NOT NULL DEFAULT 'application/pdf',
  file_size integer NOT NULL DEFAULT 0,
  version varchar(30) NOT NULL DEFAULT '1.0',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(180) NOT NULL UNIQUE,
  title varchar(220) NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  category varchar(80) NOT NULL,
  source_name varchar(180) NOT NULL,
  source_url text,
  market_date timestamptz,
  status varchar(20) NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_user_instrument_uq UNIQUE (user_id, instrument_id)
);
CREATE TABLE IF NOT EXISTS learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_progress_user_lesson_uq UNIQUE (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS virtual_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL DEFAULT 'Learning Portfolio',
  starting_cash numeric(18,2) NOT NULL DEFAULT 100000,
  cash_balance numeric(18,2) NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS virtual_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES virtual_portfolios(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instruments(id),
  side varchar(8) NOT NULL,
  quantity integer NOT NULL,
  price numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(100) NOT NULL,
  dataset varchar(100) NOT NULL,
  status varchar(20) NOT NULL,
  records_read integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  action varchar(120) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(160),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
