import pg from "pg";

const { Pool } = pg;

let pool;
let schemaPromise;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diatur. Hubungkan PostgreSQL sebelum menjalankan aplikasi.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function ensureDatabase() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          normalized_username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'cashier')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS products (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          price INTEGER NOT NULL CHECK (price > 0),
          stock INTEGER NOT NULL CHECK (stock >= 0),
          image TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          cashier_id BIGINT NOT NULL REFERENCES users(id),
          date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          method TEXT NOT NULL CHECK (method IN ('Tunai', 'QRIS', 'Debit')),
          subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
          discount INTEGER NOT NULL CHECK (discount >= 0),
          tax INTEGER NOT NULL CHECK (tax >= 0),
          total INTEGER NOT NULL CHECK (total >= 0),
          paid INTEGER NOT NULL CHECK (paid >= 0),
          change INTEGER NOT NULL CHECK (change >= 0)
        );
        CREATE TABLE IF NOT EXISTS sale_items (
          id BIGSERIAL PRIMARY KEY,
          sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          price INTEGER NOT NULL CHECK (price > 0),
          qty INTEGER NOT NULL CHECK (qty > 0)
        );
        CREATE INDEX IF NOT EXISTS sales_date_idx ON sales(date DESC);
        CREATE TABLE IF NOT EXISTS fund_entries (
          id BIGSERIAL PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('Masuk', 'Keluar')),
          note TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          date DATE NOT NULL,
          created_by BIGINT NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS fund_entries_date_idx ON fund_entries(date DESC);
      `);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return getPool();
}

export async function seedProducts(db) {
  const existing = await db.query("SELECT 1 FROM products LIMIT 1");
  if (existing.rowCount) return;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE products IN EXCLUSIVE MODE");
    const result = await client.query("SELECT 1 FROM products LIMIT 1");
    if (!result.rowCount) {
      await client.query(
        `INSERT INTO products (name, category, price, stock, image)
         VALUES
           ('Kopi Susu', 'Minuman', 18000, 50, '/images/kopi-susu.jpg'),
           ('Teh Manis', 'Minuman', 8000, 80, '/images/teh-manis.jpg'),
           ('Air Mineral', 'Minuman', 5000, 100, '/images/air-mineral.jpg'),
           ('Nasi Goreng', 'Makanan', 25000, 30, '/images/nasi-goreng.jpg'),
           ('Mie Ayam', 'Makanan', 20000, 30, '/images/mie-ayam.jpg'),
           ('Roti Bakar', 'Snack', 15000, 40, '/images/roti-bakar.jpg'),
           ('Kentang Goreng', 'Snack', 17000, 40, '/images/kentang-goreng.jpg')
         ON CONFLICT (name) DO NOTHING`
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
