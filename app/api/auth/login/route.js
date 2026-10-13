import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ensureDatabase } from "../../../../lib/db";
import { createSession, isSameOrigin, jsonError } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || username.length > 100 || password.length > 128) {
      return jsonError("Nama pengguna atau kata sandi belum benar.", 401);
    }
    const db = await ensureDatabase();
    const result = await db.query(
      "SELECT id, username, role, password_hash FROM users WHERE normalized_username = $1",
      [username.toLowerCase()]
    );
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) return jsonError("Nama pengguna atau kata sandi belum benar.", 401);
    await db.query("UPDATE users SET last_login_at = NOW(3) WHERE id = $1", [user.id]);
    const response = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
    await createSession(db, user, response);
    return response;
  } catch (error) {
    console.error("Gagal memproses login.", error);
    return jsonError("Login gagal karena layanan sedang tidak tersedia.", 503);
  }
}
