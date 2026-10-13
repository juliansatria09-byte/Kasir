import { NextResponse } from "next/server";
import { jsonError, requireRole } from "../../../../lib/auth";
import { ensureDatabase } from "../../../../lib/db";

export const runtime = "nodejs";

function validId(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

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

export async function PATCH(request, { params }) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  const { id } = await params;
  if (!validId(id)) return jsonError("ID produk tidak valid.", 400);
  try {
    const input = productInput(await request.json());
    if (input.error) return jsonError(input.error, 400);
    const db = await ensureDatabase();
    const result = await db.query(
      `UPDATE products SET name=$1, category=$2, price=$3, stock=$4, image=$5
       WHERE id=$6`,
      [input.name, input.category, input.price, input.stock, input.image, id]
    );
    const updated = await db.query(
      "SELECT id, name, category, price, stock, image FROM products WHERE id=$1",
      [id]
    );
    if (!updated.rowCount) return jsonError("Produk tidak ditemukan.", 404);
    const row = updated.rows[0];
    return NextResponse.json({ product: { ...row, id: Number(row.id), price: Number(row.price), stock: Number(row.stock) } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return jsonError("Nama produk sudah digunakan.", 409);
    console.error("Gagal mengubah produk.", error);
    return jsonError("Produk tidak dapat diperbarui saat ini.", 503);
  }
}

export async function DELETE(request, { params }) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  const { id } = await params;
  if (!validId(id)) return jsonError("ID produk tidak valid.", 400);
  try {
    const db = await ensureDatabase();
    const result = await db.query("DELETE FROM products WHERE id=$1", [id]);
    if (!result.rowCount) return jsonError("Produk tidak ditemukan.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Gagal menghapus produk.", error);
    return jsonError("Produk tidak dapat dihapus saat ini.", 503);
  }
}
