import { NextResponse } from "next/server";
import { jsonError, requireRole } from "../../../lib/auth";
import { ensureDatabase } from "../../../lib/db";

export const runtime = "nodejs";

function toIsoString(value) {
  return value ? new Date(value).toISOString() : null;
}

export async function GET(request) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;

  try {
    const db = await ensureDatabase();
    const result = await db.query(
      `SELECT id, username, role, created_at, last_login_at
       FROM users ORDER BY created_at DESC, id DESC`
    );
    return NextResponse.json({
      accounts: result.rows.map((row) => ({
        ...row,
        id: Number(row.id),
        created_at: toIsoString(row.created_at),
        last_login_at: toIsoString(row.last_login_at),
      })),
    });
  } catch (error) {
    console.error("Gagal memuat informasi akun.", error);
    return jsonError("Informasi akun tidak dapat dimuat saat ini.", 503);
  }
}
