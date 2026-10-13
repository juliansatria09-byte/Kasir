import mysql from "mysql2/promise";

let pool;
let database;
let schemaPromise;

function runQuery(connection, sql, params = []) {
  const orderedParams = [];
  const preparedSql = sql.replace(/\$(\d+)/g, (_, index) => {
    orderedParams.push(params[Number(index) - 1]);
    return "?";
  });

  const execution = orderedParams.length
    ? connection.execute(preparedSql, orderedParams)
    : connection.query(preparedSql);

  return execution.then(([result]) => {
    if (Array.isArray(result)) return { rows: result, rowCount: result.length };
    return {
      rows: [],
      rowCount: result.affectedRows,
      insertId: result.insertId,
    };
  });
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diatur. Hubungkan MySQL sebelum menjalankan aplikasi.");
  }
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== "mysql:") {
      throw new Error("DATABASE_URL harus menggunakan skema mysql://.");
    }
    const useTls = process.env.DATABASE_SSL !== "disable"
      && !url.hostname.endsWith(".railway.internal");
    pool = mysql.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: useTls ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
      timezone: "Z",
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
    database = {
      query: (sql, params) => runQuery(pool, sql, params),
      async connect() {
        const connection = await pool.getConnection();
        return {
          query: (sql, params) => runQuery(connection, sql, params),
          release: () => connection.release(),
        };
      },
    };
  }
  return database;
}

export async function ensureDatabase() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getPool();
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL,
          normalized_username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          last_login_at DATETIME(3) NULL,
          CONSTRAINT users_role_check CHECK (role IN ('admin', 'cashier'))
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token_hash CHAR(64) NOT NULL PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          expires_at DATETIME(3) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          INDEX sessions_user_id_idx (user_id),
          CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS products (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          category VARCHAR(60) NOT NULL,
          price INT NOT NULL,
          stock INT NOT NULL,
          image VARCHAR(2048) NOT NULL DEFAULT '',
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          CONSTRAINT products_price_check CHECK (price > 0),
          CONSTRAINT products_stock_check CHECK (stock >= 0)
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS sales (
          id VARCHAR(50) NOT NULL PRIMARY KEY,
          cashier_id BIGINT UNSIGNED NOT NULL,
          date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          method VARCHAR(20) NOT NULL,
          subtotal INT NOT NULL,
          discount INT NOT NULL,
          tax INT NOT NULL,
          total INT NOT NULL,
          paid INT NOT NULL,
          \`change\` INT NOT NULL,
          INDEX sales_date_idx (date DESC),
          CONSTRAINT sales_cashier_id_fk FOREIGN KEY (cashier_id) REFERENCES users(id),
          CONSTRAINT sales_method_check CHECK (method IN ('Tunai', 'QRIS', 'Debit')),
          CONSTRAINT sales_amounts_check CHECK (subtotal >= 0 AND discount >= 0 AND tax >= 0 AND total >= 0 AND paid >= 0 AND \`change\` >= 0)
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS sale_items (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          sale_id VARCHAR(50) NOT NULL,
          product_id BIGINT UNSIGNED NULL,
          name VARCHAR(100) NOT NULL,
          price INT NOT NULL,
          qty INT NOT NULL,
          CONSTRAINT sale_items_sale_id_fk FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          CONSTRAINT sale_items_product_id_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
          CONSTRAINT sale_items_price_check CHECK (price > 0),
          CONSTRAINT sale_items_qty_check CHECK (qty > 0)
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS fund_entries (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          type VARCHAR(10) NOT NULL,
          note VARCHAR(200) NOT NULL,
          amount INT NOT NULL,
          date DATE NOT NULL,
          created_by BIGINT UNSIGNED NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          INDEX fund_entries_date_idx (date DESC),
          CONSTRAINT fund_entries_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
          CONSTRAINT fund_entries_type_check CHECK (type IN ('Masuk', 'Keluar')),
          CONSTRAINT fund_entries_amount_check CHECK (amount > 0)
        ) ENGINE=InnoDB`,
      ];
      for (const statement of statements) {
        await pool.query(statement);
      }
      const [columns] = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'last_login_at'`
      );
      if (!columns.length) {
        try {
          await pool.query("ALTER TABLE users ADD COLUMN last_login_at DATETIME(3) NULL AFTER created_at");
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") throw error;
        }
      }
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return getPool();
}

export async function seedProducts(db) {
  const client = await db.connect();
  let lockAcquired = false;
  try {
    const lock = await client.query("SELECT GET_LOCK('kasir_product_seed', 10) AS acquired");
    lockAcquired = Number(lock.rows[0].acquired) === 1;
    if (!lockAcquired) throw new Error("Tidak dapat mengunci proses pengisian produk awal.");

    const existing = await client.query("SELECT 1 FROM products LIMIT 1");
    if (existing.rowCount) return;

    await client.query("START TRANSACTION");
    await client.query(
      `INSERT IGNORE INTO products (name, category, price, stock, image)
       VALUES
         ('Kopi Susu', 'Minuman', 18000, 50, '/images/kopi-susu.jpg'),
         ('Teh Manis', 'Minuman', 8000, 80, '/images/teh-manis.jpg'),
         ('Air Mineral', 'Minuman', 5000, 100, '/images/air-mineral.jpg'),
         ('Nasi Goreng', 'Makanan', 25000, 30, '/images/nasi-goreng.jpg'),
         ('Mie Ayam', 'Makanan', 20000, 30, '/images/mie-ayam.jpg'),
         ('Roti Bakar', 'Snack', 15000, 40, '/images/roti-bakar.jpg'),
         ('Kentang Goreng', 'Snack', 17000, 40, '/images/kentang-goreng.jpg')`
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (lockAcquired) await client.query("SELECT RELEASE_LOCK('kasir_product_seed')");
    client.release();
  }
}
