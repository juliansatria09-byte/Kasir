import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, requireRole } from "../../../lib/auth";
import { ensureDatabase } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const access = await requireRole(request, ["admin", "cashier"]);
  if (access.response) return access.response;
  try {
    const db = await ensureDatabase();
    const salesResult = access.user.role === "admin"
      ? await db.query("SELECT id, date, method, subtotal, discount, tax, total, paid, `change` AS `change` FROM sales ORDER BY date DESC")
      : await db.query("SELECT id, date, method, subtotal, discount, tax, total, paid, `change` AS `change` FROM sales WHERE cashier_id=$1 ORDER BY date DESC", [access.user.id]);
    if (!salesResult.rowCount) return NextResponse.json({ sales: [] });
    const ids = salesResult.rows.map((sale) => sale.id);
    const saleIdParams = ids.map((_, index) => `$${index + 1}`).join(", ");
    const itemResult = await db.query(
      `SELECT sale_id, product_id, name, price, qty FROM sale_items WHERE sale_id IN (${saleIdParams}) ORDER BY id`,
      ids
    );
    const itemsBySale = new Map();
    for (const row of itemResult.rows) {
      const items = itemsBySale.get(row.sale_id) || [];
      items.push({ id: row.product_id ? Number(row.product_id) : row.name, name: row.name, price: Number(row.price), qty: Number(row.qty) });
      itemsBySale.set(row.sale_id, items);
    }
    const sales = salesResult.rows.map((sale) => ({
      ...sale,
      date: new Date(sale.date).toISOString(),
      subtotal: Number(sale.subtotal), discount: Number(sale.discount), tax: Number(sale.tax),
      total: Number(sale.total), paid: Number(sale.paid), change: Number(sale.change),
      items: itemsBySale.get(sale.id) || [],
    }));
    return NextResponse.json({ sales });
  } catch (error) {
    console.error("Gagal memuat riwayat transaksi.", error);
    return jsonError("Riwayat transaksi tidak dapat dimuat saat ini.", 503);
  }
}

export async function POST(request) {
  const access = await requireRole(request, ["admin", "cashier"]);
  if (access.response) return access.response;
  let client;
  try {
    const body = await request.json();
    const method = ["Tunai", "QRIS", "Debit"].includes(body.method) ? body.method : null;
    const discountPercent = Number(body.discountPercent ?? 0);
    const includeTax = body.includeTax === true;
    if (!method) return jsonError("Metode pembayaran tidak valid.", 400);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return jsonError("Diskon harus antara 0 dan 100 persen.", 400);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return jsonError("Daftar produk transaksi tidak valid.", 400);
    const quantities = new Map();
    for (const item of body.items) {
      const id = Number(item.id);
      const qty = Number(item.qty);
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1) return jsonError("Jumlah produk transaksi tidak valid.", 400);
      quantities.set(id, (quantities.get(id) || 0) + qty);
    }
    const db = await ensureDatabase();
    client = await db.connect();
    await client.query("BEGIN");
    const productResult = await client.query(
      `SELECT id, name, price, stock FROM products WHERE id IN (${[...quantities.keys()].map((_, index) => `$${index + 1}`).join(", ")}) ORDER BY id FOR UPDATE`,
      [...quantities.keys()]
    );
    if (productResult.rowCount !== quantities.size) {
      await client.query("ROLLBACK");
      return jsonError("Ada produk pada pesanan yang sudah tidak tersedia.", 409);
    }
    const productMap = new Map(productResult.rows.map((product) => [Number(product.id), product]));
    const items = [...quantities].map(([id, qty]) => {
      const product = productMap.get(id);
      return { id, name: product.name, price: Number(product.price), qty, stock: Number(product.stock) };
    });
    if (items.some((item) => item.qty > item.stock)) {
      await client.query("ROLLBACK");
      return jsonError("Stok produk tidak mencukupi.", 409);
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (!Number.isSafeInteger(subtotal)) {
      await client.query("ROLLBACK");
      return jsonError("Nilai transaksi melebihi batas yang didukung.", 400);
    }
    const discount = Math.round(subtotal * discountPercent / 100);
    const tax = includeTax ? Math.round((subtotal - discount) * 0.11) : 0;
    const total = subtotal - discount + tax;
    const paid = method === "Tunai" ? Number(body.paid) : total;
    if (!Number.isSafeInteger(paid) || paid < total || paid > 2_000_000_000 || total > 2_000_000_000) {
      await client.query("ROLLBACK");
      return jsonError("Nominal pembayaran tidak mencukupi atau melebihi batas.", 400);
    }
    const sale = {
      id: `TRX-${randomUUID()}`,
      date: new Date().toISOString(),
      items: items.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      subtotal, discount, tax, total, method, paid, change: paid - total,
    };
    await client.query(
      `INSERT INTO sales (id, cashier_id, date, method, subtotal, discount, tax, total, paid, \`change\`)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [sale.id, access.user.id, new Date(sale.date), method, subtotal, discount, tax, total, paid, sale.change]
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO sale_items (sale_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)",
        [sale.id, item.id, item.name, item.price, item.qty]
      );
      await client.query("UPDATE products SET stock = stock - $1 WHERE id=$2", [item.qty, item.id]);
    }
    await client.query("COMMIT");
    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Gagal menyimpan transaksi.", error);
    return jsonError("Transaksi tidak dapat disimpan saat ini.", 503);
  } finally {
    client?.release();
  }
}
