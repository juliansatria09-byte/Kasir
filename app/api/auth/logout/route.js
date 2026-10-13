import { NextResponse } from "next/server";
import { SESSION_COOKIE, hashToken, isSameOrigin, jsonError } from "../../../../lib/auth";
import { ensureDatabase } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      const db = await ensureDatabase();
      await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Gagal mengakhiri sesi login.", error);
    return jsonError("Logout gagal karena layanan sedang tidak tersedia.", 503);
  }
}
