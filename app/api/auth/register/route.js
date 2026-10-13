import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ensureDatabase } from "../../../../lib/db";
import { isSameOrigin, jsonError } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[\p{L}\p{N}_.-]{3,30}$/u.test(username)) {
      return jsonError("Nama pengguna harus 3–30 karakter dan hanya berisi huruf, angka, titik, garis bawah, atau tanda hubung.", 400);
    }
    if (password.length < 12 || password.length > 128) {
      return jsonError("Kata sandi harus terdiri dari 12–128 karakter.", 400);
    }
    const db = await ensureDatabase();
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (username, normalized_username, password_hash, role)
       VALUES ($1, $2, $3, 'cashier')
       ON CONFLICT (normalized_username) DO NOTHING
       RETURNING id`,
      [username, username.toLowerCase(), hash]
    );
    if (!result.rowCount) return jsonError("Nama pengguna sudah digunakan.", 409);
    return NextResponse.json({ message: "Pendaftaran berhasil. Silakan masuk." }, { status: 201 });
  } catch (error) {
    console.error("Gagal mendaftarkan akun kasir.", error);
    return jsonError("Pendaftaran gagal karena layanan sedang tidak tersedia.", 503);
  }
}
