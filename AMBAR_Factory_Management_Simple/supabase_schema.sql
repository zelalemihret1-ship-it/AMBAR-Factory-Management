-- AMBAR Furniture factory management database schema (PostgreSQL)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','production','storekeeper','sales')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'piece',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workflow_entries (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  stage TEXT NOT NULL CHECK (stage IN ('Preparation','Material preparation','Cutting','Assembly','Finishing','Completed')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_on DATE,
  employee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS material_movements (
  id BIGSERIAL PRIMARY KEY,
  material_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('received','used','waste','adjustment')),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'piece',
  supplier TEXT DEFAULT '',
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  employee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('produced','sold','adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workflow_created_idx ON workflow_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS material_date_idx ON material_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS stock_date_idx ON stock_movements(movement_date DESC);
