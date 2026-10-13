import { NextResponse } from "next/server";
import { getSessionUser, isSameOrigin, jsonError } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isSameOrigin(request)) return jsonError("Permintaan lintas situs ditolak.", 403);
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Silakan masuk kembali.", 401);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Gagal memeriksa sesi login.", error);
    return jsonError("Layanan autentikasi sedang tidak tersedia.", 503);
  }
}
