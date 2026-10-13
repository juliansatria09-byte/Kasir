import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ensureDatabase } from "../../../../lib/db";
import { isSameOrigin, jsonError, secureTokenEquals } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  try {
    const db = await ensureDatabase();
    const result = await db.query("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS configured");
    return NextResponse.json({ available: !result.rows[0].configured && Boolean(process.env.ADMIN_SETUP_TOKEN) });
  } catch (error) {
    console.error("Gagal memeriksa status penyiapan admin.", error);
    return jsonError("Layanan autentikasi sedang tidak tersedia.", 503);
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken) return jsonError("Penyiapan admin belum diaktifkan.", 404);
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!secureTokenEquals(body.token, setupToken)) return jsonError("Token penyiapan tidak valid.", 403);
    if (!/^[\p{L}\p{N}_.-]{3,30}$/u.test(username)) {
      return jsonError("Nama pengguna harus 3–30 karakter dan hanya berisi huruf, angka, titik, garis bawah, atau tanda hubung.", 400);
    }
    if (password.length < 12 || password.length > 128) return jsonError("Kata sandi harus terdiri dari 12–128 karakter.", 400);
    const db = await ensureDatabase();
    const hash = await bcrypt.hash(password, 12);
    const client = await db.connect();
    let lockAcquired = false;
    try {
      const lock = await client.query("SELECT GET_LOCK('kasir_admin_setup', 10) AS acquired");
      lockAcquired = Number(lock.rows[0].acquired) === 1;
      if (!lockAcquired) return jsonError("Penyiapan admin sedang sibuk. Coba lagi sebentar.", 503);
      await client.query("START TRANSACTION");
      const admins = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
      if (admins.rowCount) {
        await client.query("ROLLBACK");
        return jsonError("Admin pertama sudah dibuat; penyiapan ini sudah dinonaktifkan.", 409);
      }
      await client.query(
        `INSERT INTO users (username, normalized_username, password_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        [username, username.toLowerCase(), hash]
      );
      await client.query("COMMIT");
      return NextResponse.json({ message: "Admin pertama berhasil dibuat. Penyiapan admin telah ditutup." }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "ER_DUP_ENTRY") return jsonError("Nama pengguna sudah digunakan.", 409);
      throw error;
    } finally {
      if (lockAcquired) await client.query("SELECT RELEASE_LOCK('kasir_admin_setup')");
      client.release();
    }
  } catch (error) {
    console.error("Gagal membuat akun admin pertama.", error);
    return jsonError("Penyiapan admin gagal karena layanan sedang tidak tersedia.", 503);
  }
}
