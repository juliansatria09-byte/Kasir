import { ensureDatabase, seedProducts } from "../../../lib/db";
import { jsonError, requireRole } from "../../../lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function productInput(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  const price = Number(body.price);
  const stock = Number(body.stock);
  if (!name || name.length > 100 || !category || category.length > 60) return { error: "Nama produk atau kategori tidak valid." };
  if (!Number.isSafeInteger(price) || price < 1 || price > 2_000_000_000) return { error: "Harga harus berupa bilangan bulat positif." };
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 2_000_000_000) return { error: "Stok tidak valid." };
  if (image.length > 2048) return { error: "URL foto terlalu panjang." };
  if (image && !image.startsWith("/") && !/^https:\/\//i.test(image)) return { error: "Foto harus berupa path lokal atau URL HTTPS." };
  return { name, category, price, stock, image };
}

export async function GET(request) {
  const access = await requireRole(request, ["admin", "cashier"]);
  if (access.response) return access.response;
  try {
    const db = await ensureDatabase();
    await seedProducts(db);
    const result = await db.query("SELECT id, name, category, price, stock, image FROM products ORDER BY id");
    return NextResponse.json({ products: result.rows.map((row) => ({ ...row, id: Number(row.id), price: Number(row.price), stock: Number(row.stock) })) });
  } catch (error) {
    console.error("Gagal memuat produk.", error);
    return jsonError("Produk tidak dapat dimuat saat ini.", 503);
  }
}

export async function POST(request) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  try {
    const input = productInput(await request.json());
    if (input.error) return jsonError(input.error, 400);
    const db = await ensureDatabase();
    const result = await db.query(
      `INSERT INTO products (name, category, price, stock, image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, category, price, stock, image`,
      [input.name, input.category, input.price, input.stock, input.image]
    );
    const row = result.rows[0];
    return NextResponse.json({ product: { ...row, id: Number(row.id), price: Number(row.price), stock: Number(row.stock) } }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") return jsonError("Nama produk sudah digunakan.", 409);
    console.error("Gagal menambahkan produk.", error);
    return jsonError("Produk tidak dapat disimpan saat ini.", 503);
  }
}
